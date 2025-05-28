-- Trigger function to call usage update after a screening report is inserted
CREATE OR REPLACE FUNCTION trg_incr_usage_from_screening_report()
RETURNS trigger AS $$
BEGIN
    PERFORM increment_screening_usage(NEW.agent_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop any existing trigger and create a new one on the screening_reports table
DROP TRIGGER IF EXISTS trg_after_ins_screening_reports ON screening_reports;
CREATE TRIGGER trg_after_ins_screening_reports
AFTER INSERT ON screening_reports
FOR EACH ROW
EXECUTE FUNCTION trg_incr_usage_from_screening_report();
