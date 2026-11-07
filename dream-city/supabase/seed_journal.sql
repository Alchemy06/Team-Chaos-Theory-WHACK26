-- Sample journal data for the city. Run after schema.sql (SQL Editor > New query > Run).
-- build_data here is hand-written; real rows come from POST /api/journal/<id>/build.
insert into journal_sessions (id, status, conversation_md, created_at, completed_at) values
  ('11111111-1111-4111-8111-111111111111', 'completed', E'# Flooded city\n\n## Dream\nI was swimming through a flooded city at night, looking for my old house.\n\n**Q:** How did you feel during the dream?\n**A:** Uneasy but curious.\n\n**Q:** Could it connect to your real life?\n**A:** We are moving flats next month.', '2026-11-01 08:00+00', '2026-11-01 08:10+00'),
  ('22222222-2222-4222-8222-222222222222', 'completed', E'# Late for the exam\n\n## Dream\nI ran through school corridors that kept getting longer. The exam had started and I had no pen.\n\n**Q:** How did you feel during the dream?\n**A:** Panicked.\n\n**Q:** Could it connect to your real life?\n**A:** Performance review on Friday.', '2026-11-02 08:00+00', '2026-11-02 08:10+00'),
  ('33333333-3333-4333-8333-333333333333', 'completed', E'# Flying over the forest\n\n## Dream\nI realised I was dreaming and flew over a pine forest towards a glowing tower.\n\n**Q:** How did you feel during the dream?\n**A:** Free and amazed.\n\n**Q:** Could it connect to your real life?\n**A:** Finished a big project yesterday.', '2026-11-03 08:00+00', '2026-11-03 08:10+00');

insert into journal_messages (id, session_id, sequence, role, content, reply_to_id) values
  ('a1000000-0000-4000-8000-000000000000', '11111111-1111-4111-8111-111111111111', 0, 'user', 'I was swimming through a flooded city at night, looking for my old house.', null),
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'assistant', 'How did you feel during the dream?', null),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 2, 'user', 'Uneasy but curious.', 'a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 3, 'assistant', 'Could it connect to your real life?', null),
  ('a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 4, 'user', 'We are moving flats next month.', 'a1000000-0000-4000-8000-000000000003');

insert into build_data (journal_id, main_emotion, secondary_emotion, build_height, hover_desc, themes) values
  ('11111111-1111-4111-8111-111111111111', 'apprehension', 'wonder', 6, 'Swimming through a flooded city, looking for an old home', '{searching,home}'),
  ('22222222-2222-4222-8222-222222222222', 'apprehension', 'anger', 8, 'Running late to an exam down endless corridors', '{being late,being judged,pressure}'),
  ('33333333-3333-4333-8333-333333333333', 'wonder', 'happiness', 7, 'A lucid flight over a forest towards a glowing tower', '{exploration,discovery,journey}');
