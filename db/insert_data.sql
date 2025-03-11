DO $$
BEGIN
  -- 1) Inactivar forzosamente todas las encuestas activas, no importa si ya vencieron
  UPDATE surveys
  SET active = false
  WHERE active = true;

  -- 2) Insertar la nueva encuesta
  INSERT INTO surveys (question)
  VALUES ('Is climate change really caused by humans?');

END $$ LANGUAGE plpgsql;
