
UPDATE kannada_queue_items
SET status='failed',
    finished_at=now(),
    last_error='manually marked failed — stuck in processing, freeing server slot'
WHERE id='61ea7e3e-d23f-41a7-b5f1-377fb0316948';

UPDATE kannada_queue_runs r SET
  completed = (SELECT count(*) FROM kannada_queue_items WHERE run_id=r.id AND status='completed'),
  failed    = (SELECT count(*) FROM kannada_queue_items WHERE run_id=r.id AND status='failed'),
  status    = CASE
    WHEN (SELECT count(*) FROM kannada_queue_items
          WHERE run_id=r.id AND status IN ('completed','failed','cancelled')) >= r.total
    THEN 'done' ELSE 'running' END;
