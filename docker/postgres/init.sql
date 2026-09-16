-- Two roles. The owner runs migrations and owns every table. The app role reads
-- and writes rows and can never change the schema.
CREATE ROLE maschina_app LOGIN PASSWORD 'maschina_dev_password';

GRANT CONNECT ON DATABASE maschina TO maschina_app;
GRANT USAGE ON SCHEMA public TO maschina_app;
ALTER DEFAULT PRIVILEGES FOR ROLE maschina_owner IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO maschina_app;
ALTER DEFAULT PRIVILEGES FOR ROLE maschina_owner IN SCHEMA public
	GRANT USAGE, SELECT ON SEQUENCES TO maschina_app;

-- Integration tests create a fresh database per run from this template.
CREATE DATABASE maschina_test_template OWNER maschina_owner;

\connect maschina_test_template
GRANT USAGE ON SCHEMA public TO maschina_app;
ALTER DEFAULT PRIVILEGES FOR ROLE maschina_owner IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO maschina_app;
ALTER DEFAULT PRIVILEGES FOR ROLE maschina_owner IN SCHEMA public
	GRANT USAGE, SELECT ON SEQUENCES TO maschina_app;
