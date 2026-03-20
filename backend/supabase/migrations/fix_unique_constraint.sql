-- Run this ONLY if you get a "no unique constraint" error during medicine sync
ALTER TABLE medical_knowledge ADD CONSTRAINT medical_knowledge_name_unique UNIQUE (name);
