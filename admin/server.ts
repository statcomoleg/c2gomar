import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Bot } from 'grammy';
import { getSupabase } from '../src/db/client';
import { parseChannelPostLink } from '../src/config';
import { awardPoints } from '../src/services/points';
import {
  resolveAudience,
  runBroadcast,
  type BroadcastAudience,
} from '../src/services/broadcast';
import { submissionsRepo, tasksRepo } from '../src/db/repositories';
import * as userTexts from '../src/bot/texts/user';

const PORT = Number(process.env.ADMIN_PORT || 3737);
const HOST = '127.0.0.1';
const PASSWORD = process.env.ADMIN_PANEL_PASSWORD || '';
const COOKIE = 'marathon_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h

if (!process.env.BOT_TOKEN) throw new Error('BOT_TOKEN обязателен');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY обязательны');
}
if (!PASSWORD) {
  throw new Error(
    'Задайте ADMIN_PANEL_PASSWORD в .env — пароль для входа в локальную админку',
  );
}

const adminTelegramId = Number(
  (process.env.ADMIN_TELEGRAM_IDS || '').split(',')[0]?.trim() || '0',
);

const bot = new Bot(process.env.BOT_TOKEN);
const sessions = new Map<string, number>();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Можно прикрепить только изображение'));
      return;
    }
    cb(null, true);
  },
});

function createSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isAuthed(req: express.Request): boolean {
  const token = req.cookies?.[COOKIE];
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, host: HOST, port: PORT });
});

app.get('/api/me', (req, res) => {
  res.json({ authenticated: isAuthed(req) });
});

app.post('/api/login', (req, res) => {
  const password = String(req.body?.password || '');
  if (password !== PASSWORD) {
    res.status(401).json({ error: 'Неверный пароль' });
    return;
  }
  const token = createSession();
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS,
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) sessions.delete(token);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get('/api/dashboard', requireAuth, async (_req, res) => {
  try {
    const sb = getSupabase();
    const [
      usersCount,
      joinedCount,
      pendingCount,
      tasksCount,
      settings,
    ] = await Promise.all([
      sb.from('users').select('id', { count: 'exact', head: true }),
      sb
        .from('users')
        .select('id', { count: 'exact', head: true })
        .not('joined_channel_at', 'is', null),
      sb
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      sb
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      sb.from('app_settings').select('*').eq('id', true).maybeSingle(),
    ]);
    res.json({
      users: usersCount.count ?? 0,
      joined: joinedCount.count ?? 0,
      pending: pendingCount.count ?? 0,
      tasks: tasksCount.count ?? 0,
      settings: settings.data,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const sb = getSupabase();
    let query = sb
      .from('users')
      .select(
        'id, username, first_name, joined_channel_at, total_points, last_points_at, onboarding_step, created_at',
      )
      .order('total_points', { ascending: false })
      .limit(200);

    if (q) {
      if (/^\d+$/.test(q)) {
        query = query.eq('id', Number(q));
      } else {
        query = query.or(
          `username.ilike.%${q}%,first_name.ilike.%${q}%`,
        );
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ users: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/users/:id/points', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const points = Number(req.body?.points);
    if (!Number.isInteger(points) || points === 0) {
      res.status(400).json({ error: 'points — целое ≠ 0' });
      return;
    }
    const result = await awardPoints({
      userId,
      points,
      reason: 'manual',
      adminId: adminTelegramId || null,
    });
    try {
      await bot.api.sendMessage(
        userId,
        userTexts.manualPointsText(points, result.newTotal),
      );
    } catch (err) {
      console.error('[admin] notify user', err);
    }
    res.json({ ok: true, newTotal: result.newTotal });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/users/:id/joined', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const joined = Boolean(req.body?.joined);
    const sb = getSupabase();
    const { data, error } = await sb
      .from('users')
      .update({
        joined_channel_at: joined ? new Date().toISOString() : null,
      })
      .eq('id', userId)
      .select(
        'id, username, first_name, joined_channel_at, total_points, onboarding_step',
      )
      .single();
    if (error) throw error;
    res.json({ user: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/ranking', requireAuth, async (_req, res) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('users')
      .select('id, username, first_name, total_points, last_points_at, joined_channel_at')
      .order('total_points', { ascending: false })
      .order('last_points_at', { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    res.json({
      ranking: (data ?? []).map((u, i) => ({ ...u, rank: i + 1 })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/ledger', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const sb = getSupabase();
    let query = sb
      .from('points_ledger')
      .select(
        'id, user_id, points, reason, related_submission_id, related_task_id, admin_id, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(100);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ ledger: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/submissions', requireAuth, async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const sb = getSupabase();
    const { data, error } = await sb
      .from('submissions')
      .select(
        `id, task_id, user_id, comment_text, status, points_awarded, submitted_at, reviewed_at, admin_feedback,
         tasks ( id, label, description, type, channel_post_link ),
         users ( id, username, first_name, total_points )`,
      )
      .eq('status', status)
      .order('submitted_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ submissions: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/submissions/:id/review', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const action = String(req.body?.action || '');
    const feedback = req.body?.feedback ? String(req.body.feedback) : null;

    const existing = await submissionsRepo.getSubmissionById(id);
    if (!existing) {
      res.status(404).json({ error: 'Не найдено' });
      return;
    }
    if (existing.status !== 'pending') {
      res.status(409).json({ error: 'Уже обработано' });
      return;
    }

    const task = await tasksRepo.getTaskById(existing.task_id);
    if (!task) {
      res.status(404).json({ error: 'Задание не найдено' });
      return;
    }

    if (action === 'reject') {
      await submissionsRepo.reviewSubmission({
        id,
        status: 'rejected',
        reviewed_by: adminTelegramId > 0 ? adminTelegramId : null,
        admin_feedback: feedback,
      });
      try {
        await bot.api.sendMessage(
          existing.user_id,
          userTexts.taskRejectedText(task.label),
        );
      } catch (err) {
        console.error(err);
      }
      res.json({ ok: true, status: 'rejected' });
      return;
    }

    const points = action === 'approve10' ? 10 : action === 'approve3' ? 3 : Number(req.body?.points);
    if (![3, 10].includes(points) && !(Number.isInteger(points) && points !== 0)) {
      res.status(400).json({ error: 'Укажите action approve3|approve10|reject или points' });
      return;
    }
    const pts = Number.isFinite(points) ? points : 3;

    const updated = await submissionsRepo.reviewSubmission({
      id,
      status: 'approved',
      points_awarded: pts,
      reviewed_by: adminTelegramId > 0 ? adminTelegramId : null,
    });
    if (!updated) {
      res.status(409).json({ error: 'Уже обработано' });
      return;
    }

    const { newTotal } = await awardPoints({
      userId: existing.user_id,
      points: pts,
      reason: 'task_approved',
      relatedSubmissionId: id,
      relatedTaskId: task.id,
      adminId: adminTelegramId || null,
    });

    try {
      await bot.api.sendMessage(
        existing.user_id,
        userTexts.taskApprovedText(task.label, pts, newTotal),
      );
    } catch (err) {
      console.error(err);
    }

    res.json({ ok: true, status: 'approved', points: pts, newTotal });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/tasks', requireAuth, async (_req, res) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('tasks')
      .select(
        'id, type, label, description, channel_post_link, channel_message_id, discussion_message_id, is_active, created_at',
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ tasks: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const type = req.body?.type === 'main' ? 'main' : 'pre';
    const description = String(req.body?.description || '').trim();
    const link = String(req.body?.channel_post_link || '').trim();
    if (!description || description.length > 500) {
      res.status(400).json({ error: 'description 1–500 символов' });
      return;
    }
    const parsed = parseChannelPostLink(link);
    if (!parsed) {
      res.status(400).json({ error: 'Неверная ссылка на пост' });
      return;
    }
    const existing = await tasksRepo.findByChannelMessageId(parsed.channelMessageId);
    if (existing) {
      res.status(409).json({ error: `Уже есть: ${existing.label}` });
      return;
    }
    const count = await tasksRepo.countByType(type);
    const label = type === 'pre' ? `ПДЗ ${count + 1}` : `ДЗ ${count + 1}`;
    const task = await tasksRepo.createTask({
      type,
      label,
      description,
      channel_post_link: parsed.normalizedLink,
      channel_message_id: parsed.channelMessageId,
      created_by: adminTelegramId > 0 ? adminTelegramId : null,
    });
    res.json({ task });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const patch: Record<string, unknown> = {};
    if (typeof req.body?.description === 'string') patch.description = req.body.description;
    if (typeof req.body?.is_active === 'boolean') patch.is_active = req.body.is_active;
    if (typeof req.body?.channel_post_link === 'string') {
      const parsed = parseChannelPostLink(req.body.channel_post_link);
      if (!parsed) {
        res.status(400).json({ error: 'Неверная ссылка' });
        return;
      }
      patch.channel_post_link = parsed.normalizedLink;
      patch.channel_message_id = parsed.channelMessageId;
    }
    const sb = getSupabase();
    const { data, error } = await sb
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ task: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/settings', requireAuth, async (_req, res) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('app_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    res.json({ settings: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    const patch: Record<string, unknown> = {};
    if (req.body?.marathon_start_at) patch.marathon_start_at = req.body.marathon_start_at;
    if (req.body?.channel_id != null) patch.channel_id = Number(req.body.channel_id);
    if (req.body?.discussion_group_id != null) {
      patch.discussion_group_id = Number(req.body.discussion_group_id);
    }
    if (typeof req.body?.channel_invite_link === 'string') {
      patch.channel_invite_link = req.body.channel_invite_link;
    }
    const sb = getSupabase();
    const { data, error } = await sb
      .from('app_settings')
      .update(patch)
      .eq('id', true)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ settings: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/onboarding', requireAuth, async (_req, res) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('onboarding_messages')
      .select('*')
      .order('step_order', { ascending: true });
    if (error) throw error;
    res.json({ messages: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch('/api/onboarding/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const patch: Record<string, unknown> = {};
    for (const key of [
      'text',
      'delay_seconds',
      'button_text',
      'button_url',
      'only_if_not_joined',
      'media_type',
      'local_media_paths',
    ]) {
      if (req.body?.[key] !== undefined) patch[key] = req.body[key];
    }
    const sb = getSupabase();
    const { data, error } = await sb
      .from('onboarding_messages')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ message: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post(
  '/api/broadcast',
  requireAuth,
  (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const text = String(req.body?.text || '').trim();
      if (!text) {
        res.status(400).json({ error: 'Нужен текст' });
        return;
      }
      const kind = String(req.body?.audience || 'all');
      let audience: BroadcastAudience = { kind: 'all' };
      if (kind === 'gt' || kind === 'lt') {
        const n = Number(req.body?.n);
        if (!Number.isInteger(n)) {
          res.status(400).json({ error: 'Нужен порог N' });
          return;
        }
        audience = { kind, n };
      }

      const recipients = await resolveAudience(audience);
      const file = req.file;

      res.json({
        ok: true,
        started: true,
        total: recipients.length,
        withPhoto: Boolean(file),
        message: 'Рассылка запущена в фоне',
      });

      runBroadcast(
        bot.api,
        audience,
        {
          text,
          parseMode: 'HTML',
          photoBuffer: file?.buffer,
          photoFilename: file?.originalname || 'photo.jpg',
        },
        (result) => {
          console.log('[admin broadcast]', result);
        },
      );
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  },
);

app.post('/api/broadcast/preview-count', requireAuth, async (req, res) => {
  try {
    const kind = String(req.body?.audience || 'all');
    let audience: BroadcastAudience = { kind: 'all' };
    if (kind === 'gt' || kind === 'lt') {
      audience = { kind, n: Number(req.body?.n) || 0 };
    }
    const ids = await resolveAudience(audience);
    res.json({ count: ids.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// index.html отдаётся static middleware из admin/public

app.listen(PORT, HOST, () => {
  console.log(`Админка: http://${HOST}:${PORT}`);
  console.log('Только localhost — снаружи недоступна.');
});
