-- С «Есть ли у вас планы» (шаг 3) и далее — только если ещё не в канале
update onboarding_messages
set only_if_not_joined = true
where step_order >= 3;

update onboarding_messages
set only_if_not_joined = false
where step_order < 3;
