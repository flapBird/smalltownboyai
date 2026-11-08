-- Enforce bindings inside the same D1 batch, including concurrent webhook deliveries.
CREATE TRIGGER payment_event_identity BEFORE INSERT ON payment_events
WHEN EXISTS (SELECT 1 FROM payment_events WHERE id=NEW.id AND (order_id<>NEW.order_id OR type<>NEW.type))
BEGIN
 SELECT RAISE(ABORT,'payment event identity conflict');
END;
--> statement-breakpoint
CREATE TRIGGER payment_provider_identity BEFORE UPDATE OF provider_id ON payment_orders
WHEN OLD.provider_id IS NOT NULL AND NEW.provider_id IS NOT OLD.provider_id
BEGIN
 SELECT RAISE(ABORT,'payment provider identity conflict');
END;
