SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'012')
  BEGIN
    ALTER TABLE cacsms.OpportunityOperationalSettings DROP CONSTRAINT CK_OpportunityOperationalSettings_Value;
    ALTER TABLE cacsms.OpportunityOperationalSettings ADD CONSTRAINT CK_OpportunityOperationalSettings_Value
      CHECK (ISJSON(ValueJson)=1 OR ISJSON(CONCAT(N'{"value":',ValueJson,N'}'))=1);
    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    INSERT cacsms.OpportunityOperationalSettings(WorkspaceId,PageSlug,SettingKey,ValueJson,UpdatedBy)
    SELECT @WorkspaceId,N'autonomy-modes',source.SettingKey,source.ValueJson,N'System migration'
    FROM (VALUES
      (N'currentMode',N'"Supervised Autonomy"'),
      (N'safeguard:Confidence Threshold',N'true'),
      (N'safeguard:High-impact Approval',N'true'),
      (N'safeguard:Budget Guardrail',N'true'),
      (N'safeguard:Emergency Stop',N'true')
    ) source(SettingKey,ValueJson)
    WHERE NOT EXISTS(SELECT 1 FROM cacsms.OpportunityOperationalSettings target WHERE target.WorkspaceId=@WorkspaceId AND target.PageSlug=N'autonomy-modes' AND target.SettingKey=source.SettingKey);
    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'012',N'Autonomy default configuration',HASHBYTES('SHA2_256',N'012:Autonomy default configuration'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
