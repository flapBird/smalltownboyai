-- D1 batches are transactional. Ledger insertion and wallet mutation are inseparable.
CREATE TRIGGER wallet_on_user AFTER INSERT ON user BEGIN
 INSERT OR IGNORE INTO user_wallets (user_id,balance,reserved,tier) VALUES (NEW.id,0,0,0);
END;
CREATE TRIGGER ledger_guard BEFORE INSERT ON credit_transactions WHEN NOT EXISTS (SELECT 1 FROM credit_transactions WHERE business_key=NEW.business_key) BEGIN
 SELECT CASE WHEN NEW.delta != CAST(NEW.delta AS INTEGER) OR NEW.reserved_delta != CAST(NEW.reserved_delta AS INTEGER) THEN RAISE(ABORT,'integer credits required') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM user_wallets WHERE user_id=NEW.user_id) THEN RAISE(ABORT,'wallet missing') END;
 SELECT CASE WHEN NEW.kind='reserve' AND (SELECT balance FROM user_wallets WHERE user_id=NEW.user_id) < -NEW.delta THEN RAISE(ABORT,'insufficient credits') END;
 SELECT CASE WHEN (SELECT reserved FROM user_wallets WHERE user_id=NEW.user_id)+NEW.reserved_delta<0 THEN RAISE(ABORT,'invalid reserved credits') END;
END;
CREATE TRIGGER ledger_apply AFTER INSERT ON credit_transactions BEGIN
 UPDATE user_wallets SET balance=balance+NEW.delta,reserved=reserved+NEW.reserved_delta WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON credit_transactions BEGIN SELECT RAISE(ABORT,'immutable ledger'); END;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON credit_transactions BEGIN SELECT RAISE(ABORT,'immutable ledger'); END;
INSERT INTO credit_packages VALUES ('lite',890,100,1),('standard',1690,200,2),('pro',4990,600,3);
INSERT INTO settings VALUES ('generation_paused','false');
