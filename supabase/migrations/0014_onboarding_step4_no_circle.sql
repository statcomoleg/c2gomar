-- Шаг 4: вместо video_note — обычное сообщение с кнопкой
update onboarding_messages set
  media_type = null,
  media_file_id = null,
  local_media_paths = null,
  button_text = 'Присоединиться к практикуму',
  button_url = 'https://t.me/+4zgobAW0C-wzYjYy',
  text = E'Заберу буквально минуту — сэкономлю вам вечность. 🙂\n\nЗаходите на <a href="https://content2go.app/refH4kGr6DM">платформу</a> в кабинет, выбираете формат под нишу, настраиваете ветку и запускаете: видео, посты и статьи генерятся сами.\n\nКлиенты платят креаторам несколько тысяч за одно такое видео, а на <a href="https://content2go.app/refH4kGr6DM">платформе</a> оно делается автоматически и стоит около 160 ₽.\n\nЖду вас на практикуме <b>17 августа</b>.'
where step_order = 4;
