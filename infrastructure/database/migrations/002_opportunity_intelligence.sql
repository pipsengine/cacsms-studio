SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'002')
  BEGIN
    CREATE TABLE cacsms.OpportunitySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_OpportunitySettings PRIMARY KEY,
      ScanHorizonDays int NOT NULL CONSTRAINT DF_OpportunitySettings_Horizon DEFAULT 30,
      PrimaryMarket nvarchar(150) NOT NULL CONSTRAINT DF_OpportunitySettings_Market DEFAULT N'Nigeria + West Africa',
      SignalSensitivity tinyint NOT NULL CONSTRAINT DF_OpportunitySettings_Sensitivity DEFAULT 72,
      MinimumConfidence tinyint NOT NULL CONSTRAINT DF_OpportunitySettings_Confidence DEFAULT 70,
      IncludeWeakSignals bit NOT NULL CONSTRAINT DF_OpportunitySettings_Weak DEFAULT 1,
      DetectAnomalies bit NOT NULL CONSTRAINT DF_OpportunitySettings_Anomalies DEFAULT 1,
      CrossCheckCompetitors bit NOT NULL CONSTRAINT DF_OpportunitySettings_Competitors DEFAULT 1,
      LastScanAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunitySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_OpportunitySettings_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunitySettings_Horizon CHECK (ScanHorizonDays BETWEEN 1 AND 365),
      CONSTRAINT CK_OpportunitySettings_Sensitivity CHECK (SignalSensitivity BETWEEN 1 AND 100),
      CONSTRAINT CK_OpportunitySettings_Confidence CHECK (MinimumConfidence BETWEEN 1 AND 100)
    );

    CREATE TABLE cacsms.OpportunitySignals (
      SignalId uniqueidentifier NOT NULL CONSTRAINT PK_OpportunitySignals PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      Subject nvarchar(300) NOT NULL,
      SourceMix nvarchar(300) NOT NULL,
      Velocity smallint NOT NULL,
      Novelty tinyint NOT NULL,
      Durability nvarchar(20) NOT NULL,
      Relevance tinyint NOT NULL,
      SignalScore tinyint NOT NULL,
      State nvarchar(40) NOT NULL,
      IsWatchlisted bit NOT NULL CONSTRAINT DF_OpportunitySignals_Watchlisted DEFAULT 0,
      IsAnomaly bit NOT NULL CONSTRAINT DF_OpportunitySignals_Anomaly DEFAULT 0,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunitySignals_Created DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunitySignals_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_OpportunitySignals_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunitySignals_Novelty CHECK (Novelty BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunitySignals_Relevance CHECK (Relevance BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunitySignals_Score CHECK (SignalScore BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunitySignals_Durability CHECK (Durability IN (N'Low', N'Medium', N'High'))
    );
    CREATE INDEX IX_OpportunitySignals_Workspace_Score ON cacsms.OpportunitySignals(WorkspaceId, SignalScore DESC, CreatedAt DESC);

    CREATE TABLE cacsms.Opportunities (
      OpportunityId uniqueidentifier NOT NULL CONSTRAINT PK_Opportunities PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      BrandId uniqueidentifier NULL,
      SourceSignalId uniqueidentifier NULL,
      Title nvarchar(300) NOT NULL,
      Subtitle nvarchar(400) NULL,
      Category nvarchar(100) NOT NULL,
      EstimatedValue decimal(18,2) NOT NULL CONSTRAINT DF_Opportunities_Value DEFAULT 0,
      Confidence tinyint NOT NULL,
      Timing nvarchar(60) NOT NULL,
      OwnerName nvarchar(150) NOT NULL,
      OpportunityScore tinyint NOT NULL,
      Status nvarchar(50) NOT NULL,
      MarketDemand tinyint NOT NULL,
      StrategicFit tinyint NOT NULL,
      ExecutionReadiness tinyint NOT NULL,
      CompetitiveWhitespace tinyint NOT NULL,
      IsHighPriority bit NOT NULL CONSTRAINT DF_Opportunities_High DEFAULT 0,
      IsAtRisk bit NOT NULL CONSTRAINT DF_Opportunities_Risk DEFAULT 0,
      IsArchived bit NOT NULL CONSTRAINT DF_Opportunities_Archived DEFAULT 0,
      LastOpenedAt datetimeoffset(0) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Opportunities_Created DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Opportunities_Updated DEFAULT SYSUTCDATETIME(),
      RowVersion rowversion NOT NULL,
      CONSTRAINT FK_Opportunities_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_Opportunities_Brands FOREIGN KEY (BrandId) REFERENCES cacsms.Brands(BrandId),
      CONSTRAINT FK_Opportunities_Signals FOREIGN KEY (SourceSignalId) REFERENCES cacsms.OpportunitySignals(SignalId) ON DELETE SET NULL,
      CONSTRAINT CK_Opportunities_Value CHECK (EstimatedValue >= 0),
      CONSTRAINT CK_Opportunities_Confidence CHECK (Confidence BETWEEN 0 AND 100),
      CONSTRAINT CK_Opportunities_Score CHECK (OpportunityScore BETWEEN 0 AND 100),
      CONSTRAINT CK_Opportunities_MarketDemand CHECK (MarketDemand BETWEEN 0 AND 100),
      CONSTRAINT CK_Opportunities_StrategicFit CHECK (StrategicFit BETWEEN 0 AND 100),
      CONSTRAINT CK_Opportunities_Readiness CHECK (ExecutionReadiness BETWEEN 0 AND 100),
      CONSTRAINT CK_Opportunities_Whitespace CHECK (CompetitiveWhitespace BETWEEN 0 AND 100)
    );
    CREATE INDEX IX_Opportunities_Workspace_Score ON cacsms.Opportunities(WorkspaceId, IsArchived, OpportunityScore DESC);

    DECLARE @WorkspaceId uniqueidentifier = (SELECT TOP (1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL
    BEGIN
      SET @WorkspaceId = NEWID();
      INSERT cacsms.Workspaces (WorkspaceId, Code, Name) VALUES (@WorkspaceId, N'cacsms-studio', N'CACSMS Studio');
    END;
    DECLARE @BrandId uniqueidentifier = (SELECT TOP (1) BrandId FROM cacsms.Brands WHERE WorkspaceId=@WorkspaceId AND IsActive=1 ORDER BY CreatedAt);
    IF @BrandId IS NULL
    BEGIN
      SET @BrandId = NEWID();
      INSERT cacsms.Brands (BrandId, WorkspaceId, Name, Slug) VALUES (@BrandId, @WorkspaceId, N'CACSMS', N'cacsms');
    END;
    INSERT cacsms.OpportunitySettings (WorkspaceId, LastScanAt) VALUES (@WorkspaceId, DATEADD(MINUTE, -6, SYSUTCDATETIME()));

    INSERT cacsms.OpportunitySignals (WorkspaceId, Subject, SourceMix, Velocity, Novelty, Durability, Relevance, SignalScore, State, IsWatchlisted, IsAnomaly) VALUES
      (@WorkspaceId,N'Enterprise demand for agentic AI operations',N'Search + social + procurement',184,94,N'High',97,96,N'Breakout',0,1),
      (@WorkspaceId,N'Industrial AI training demand in West Africa',N'Search + jobs + surveys',126,89,N'High',96,93,N'Accelerating',0,0),
      (@WorkspaceId,N'Digital twins for construction SMEs',N'Industry media + tenders',92,86,N'Medium',91,89,N'Emerging',0,0),
      (@WorkspaceId,N'Predictive maintenance skills shortage',N'Jobs + forums + reports',78,82,N'High',90,87,N'Opportunity forming',0,0),
      (@WorkspaceId,N'Local-language technical education',N'Social + search',61,91,N'Medium',88,85,N'New',1,0),
      (@WorkspaceId,N'Generic chatbot tutorial content',N'Search + video',-28,32,N'Low',48,41,N'Declining',0,0);

    DECLARE @TrainingSignal uniqueidentifier = (SELECT TOP 1 SignalId FROM cacsms.OpportunitySignals WHERE WorkspaceId=@WorkspaceId AND Subject LIKE N'Industrial AI training%');
    INSERT cacsms.Opportunities (WorkspaceId,BrandId,SourceSignalId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk) VALUES
      (@WorkspaceId,@BrandId,@TrainingSignal,N'AI Skills Academy for African Manufacturers',N'Workforce transformation · Nigeria + West Africa',N'Workforce transformation',72000000,92,N'Act now',N'Learning Studio',94,N'Ready to activate',82,96,82,87,1,0),
      (@WorkspaceId,@BrandId,NULL,N'Industrial AI Documentary Series',N'Content franchise · Pan-African',N'Content franchise',46000000,89,N'30 days',N'Production Studio',91,N'High priority',87,91,78,84,1,0),
      (@WorkspaceId,@BrandId,NULL,N'Smart Factory Benchmark Report',N'Thought leadership · B2B',N'Thought leadership',31000000,86,N'Q3 2026',N'Content Intelligence',88,N'Quick win',84,89,76,82,0,0),
      (@WorkspaceId,@BrandId,NULL,N'Predictive Maintenance Partner Program',N'Partnership · Manufacturing',N'Partnership',58000000,81,N'60 days',N'Partnerships',85,N'Validate',79,88,71,76,0,0),
      (@WorkspaceId,@BrandId,NULL,N'Digital Twins Executive Briefing',N'Audience growth · Enterprise',N'Audience growth',22000000,78,N'45 days',N'Marketing',82,N'Monitoring',76,83,69,72,0,0),
      (@WorkspaceId,@BrandId,NULL,N'Generic AI News Newsletter',N'Content product · General',N'Content product',8000000,44,N'Crowded',N'Unassigned',49,N'Low priority',43,52,48,31,0,1);

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (N'002', N'Opportunity intelligence', HASHBYTES('SHA2_256', N'002:Opportunity intelligence'));
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
