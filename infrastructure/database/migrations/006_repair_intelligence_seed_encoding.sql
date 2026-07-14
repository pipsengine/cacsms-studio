SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'006')
  BEGIN
    UPDATE cacsms.IntelligenceItems SET AttributesJson=N'{"direction":"Positive","impact":"Very high","confidence":94,"horizon":"6-18 months","a":94,"b":96,"c":88}' WHERE EngineSlug=N'global-intelligence' AND Score=96;
    UPDATE cacsms.IntelligenceItems SET AttributesJson=N'{"direction":"Mixed","impact":"High","confidence":93,"horizon":"3-12 months","a":93,"b":88,"c":84}' WHERE EngineSlug=N'global-intelligence' AND Score=88;
    UPDATE cacsms.IntelligenceItems SET AttributesJson=N'{"direction":"Positive","impact":"High","confidence":86,"horizon":"18-36 months","a":86,"b":85,"c":82}' WHERE EngineSlug=N'global-intelligence' AND Score=85;
    UPDATE cacsms.IntelligenceItems SET AttributesJson=N'{"direction":"Mixed","impact":"Medium-high","confidence":89,"horizon":"6-24 months","a":89,"b":83,"c":80}' WHERE EngineSlug=N'global-intelligence' AND Score=83;
    UPDATE cacsms.IntelligenceItems SET AttributesJson=N'{"direction":"Negative","impact":"Medium","confidence":81,"horizon":"3-9 months","a":81,"b":54,"c":42}' WHERE EngineSlug=N'global-intelligence' AND Score=54;
    UPDATE cacsms.IntelligenceItems SET Title=N'Inside Aba''s 24-hour manufacturing economy' WHERE EngineSlug=N'life-explorer-engine' AND Score=94;
    UPDATE cacsms.IntelligenceItems SET Title=N'The women running West Africa''s informal logistics' WHERE EngineSlug=N'life-explorer-engine' AND Score=91;
    UPDATE cacsms.IntelligenceItems SET State=N'3-12 months' WHERE EngineSlug=N'trend-intelligence' AND Score=94;
    UPDATE cacsms.IntelligenceItems SET State=N'6-18 months' WHERE EngineSlug=N'trend-intelligence' AND Score=91;
    UPDATE cacsms.IntelligenceItems SET State=N'3-9 months' WHERE EngineSlug=N'trend-intelligence' AND Score=89;
    INSERT dbo.SchemaMigrations(Version,Name,Checksum) VALUES(N'006',N'Repair intelligence seed encoding',HASHBYTES('SHA2_256',N'006:Repair intelligence seed encoding'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
