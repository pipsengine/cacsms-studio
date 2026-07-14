SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'011')
  BEGIN
    DELETE FROM cacsms.Opportunities
    WHERE Title IN (
      N'AI Skills Academy for African Manufacturers', N'Industrial AI Documentary Series',
      N'Smart Factory Benchmark Report', N'Predictive Maintenance Partner Program',
      N'Digital Twins Executive Briefing', N'Generic AI News Newsletter'
    ) AND OwnerName IN (N'Learning Studio',N'Production Studio',N'Content Intelligence',N'Partnerships',N'Marketing',N'Unassigned');

    DELETE FROM cacsms.OpportunitySignals
    WHERE Subject IN (
      N'Enterprise demand for agentic AI operations', N'Industrial AI training demand in West Africa',
      N'Digital twins for construction SMEs', N'Predictive maintenance skills shortage',
      N'Local-language technical education', N'Generic chatbot tutorial content'
    );

    DELETE FROM cacsms.IntelligenceItems
    WHERE EngineSlug IN (
      N'global-intelligence',N'human-interest-intelligence',N'mystery-intelligence',N'curiosity-engine',
      N'emotional-opportunity-engine',N'life-explorer-engine',N'trend-intelligence',N'gap-detection',N'scoring-engine'
    );

    UPDATE cacsms.IntelligenceEngineSettings SET MetricsJson=N'[]', UpdatedAt=SYSUTCDATETIME()
    WHERE EngineSlug IN (
      N'global-intelligence',N'human-interest-intelligence',N'mystery-intelligence',N'curiosity-engine',
      N'emotional-opportunity-engine',N'life-explorer-engine',N'trend-intelligence',N'gap-detection',N'scoring-engine'
    );

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'011',N'Remove opportunity mock data',HASHBYTES('SHA2_256',N'011:Remove opportunity mock data'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
