SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'007')
  BEGIN
    CREATE TABLE cacsms.OpportunityScoringWeights (
      WorkspaceId uniqueidentifier NOT NULL,
      ModelName nvarchar(100) NOT NULL,
      FactorKey nvarchar(60) NOT NULL,
      Label nvarchar(120) NOT NULL,
      Description nvarchar(300) NOT NULL,
      Weight tinyint NOT NULL,
      Rating nvarchar(20) NOT NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityScoringWeights_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT PK_OpportunityScoringWeights PRIMARY KEY(WorkspaceId,ModelName,FactorKey),
      CONSTRAINT FK_OpportunityScoringWeights_Workspaces FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunityScoringWeights_Weight CHECK(Weight BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunityScoringWeights_Rating CHECK(Rating IN(N'Low',N'Medium',N'High'))
    );

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50007,'An active workspace is required.',1;

    INSERT cacsms.IntelligenceEngineSettings(WorkspaceId,EngineSlug,PrimaryMarket,SignalSensitivity,MetricsJson,LastRunAt) VALUES
      (@WorkspaceId,N'gap-detection',N'All Markets',80,N'[{"value":"128","label":"Detected Gaps","detail":"+18 this week","tone":"purple"},{"value":"34","label":"High-Potential","detail":"27% of total","tone":"green"},{"value":"61","label":"Low Competition","detail":"Strong opportunity","tone":"orange"},{"value":"42.8M","label":"Est. Audience Reach","detail":"Across active markets","tone":"blue"}]',DATEADD(MINUTE,-8,SYSUTCDATETIME())),
      (@WorkspaceId,N'scoring-engine',N'All Markets',85,N'[{"value":"1,284","label":"Opportunities Scored","detail":"+96 this week","tone":"purple"},{"value":"186","label":"High-Value Opportunities","detail":"14.5% of total","tone":"green"},{"value":"78.4","label":"Average Score","detail":"+3.2 vs last run","tone":"orange"},{"value":"Opportunity v3.2","label":"Active Scoring Model","detail":"94% confidence","tone":"blue"}]',DATEADD(MINUTE,-6,SYSUTCDATETIME()));

    INSERT cacsms.IntelligenceItems(WorkspaceId,EngineSlug,Title,Subtitle,Category,Score,State,AttributesJson,IsRisk) VALUES
      (@WorkspaceId,N'gap-detection',N'AI in African Manufacturing',N'Industrial transformation',N'Missing Coverage',94,N'Ready',N'{"demand":"Very High","competition":"Low","potential":94,"market":"Africa","trend":96,"x":24,"y":22,"reach":28}',0),
      (@WorkspaceId,N'gap-detection',N'The Hidden Systems Behind Cities',N'Invisible infrastructure',N'Perspective Gap',91,N'Ready',N'{"demand":"High","competition":"Low","potential":91,"market":"Global","trend":92,"x":15,"y":40,"reach":14}',0),
      (@WorkspaceId,N'gap-detection',N'Jobs Humans Still Do Better',N'Future of skilled work',N'Weak Coverage',87,N'Validate',N'{"demand":"High","competition":"Medium","potential":87,"market":"Global","trend":70,"x":58,"y":18,"reach":22}',0),
      (@WorkspaceId,N'gap-detection',N'Rural Innovation Without Headlines',N'Underserved communities',N'Missing Coverage',86,N'Ready',N'{"demand":"High","competition":"Low","potential":86,"market":"Africa","trend":90,"x":60,"y":43,"reach":18}',0),
      (@WorkspaceId,N'gap-detection',N'Climate Technology That Already Works',N'Adaptation solutions',N'Outdated Coverage',82,N'Research',N'{"demand":"Medium","competition":"Low","potential":82,"market":"Global","trend":88,"x":78,"y":30,"reach":20}',0),
      (@WorkspaceId,N'gap-detection',N'Deep Sea Systems',N'Frontier infrastructure',N'Perspective Gap',78,N'Research',N'{"demand":"Medium","competition":"High","potential":78,"market":"Global","trend":62,"x":79,"y":62,"reach":12}',0),

      (@WorkspaceId,N'scoring-engine',N'AI in African Manufacturing',N'Industrial transformation',N'High Value',94,N'Ready',N'{"demand":96,"gap":92,"momentum":91,"resonance":90,"strategicFit":94,"feasibility":82,"confidence":96}',0),
      (@WorkspaceId,N'scoring-engine',N'The Hidden Systems Behind Cities',N'Invisible infrastructure',N'High Value',91,N'Ready',N'{"demand":92,"gap":95,"momentum":84,"resonance":91,"strategicFit":90,"feasibility":78,"confidence":94}',0),
      (@WorkspaceId,N'scoring-engine',N'Jobs Humans Still Do Better',N'Future of work',N'Priority',87,N'Validate',N'{"demand":89,"gap":83,"momentum":86,"resonance":92,"strategicFit":85,"feasibility":80,"confidence":91}',0),
      (@WorkspaceId,N'scoring-engine',N'Rural Innovation Without Headlines',N'African innovation',N'Priority',86,N'Ready',N'{"demand":88,"gap":94,"momentum":79,"resonance":88,"strategicFit":84,"feasibility":76,"confidence":90}',0),
      (@WorkspaceId,N'scoring-engine',N'Climate Technology That Already Works',N'Climate adaptation',N'Strategic',82,N'Review',N'{"demand":84,"gap":79,"momentum":88,"resonance":81,"strategicFit":86,"feasibility":83,"confidence":89}',0);

    INSERT cacsms.OpportunityScoringWeights(WorkspaceId,ModelName,FactorKey,Label,Description,Weight,Rating) VALUES
      (@WorkspaceId,N'Opportunity v3.2',N'demand',N'Audience Demand',N'Search interest, engagement and unmet need',25,N'High'),
      (@WorkspaceId,N'Opportunity v3.2',N'gap',N'Content Supply Gap',N'Existing coverage and competitive saturation',20,N'High'),
      (@WorkspaceId,N'Opportunity v3.2',N'momentum',N'Trend Momentum',N'Growth velocity and signal persistence',18,N'High'),
      (@WorkspaceId,N'Opportunity v3.2',N'resonance',N'Emotional Resonance',N'Curiosity, surprise and human relevance',15,N'Medium'),
      (@WorkspaceId,N'Opportunity v3.2',N'strategicFit',N'Strategic Fit',N'Brand alignment and channel suitability',12,N'Medium'),
      (@WorkspaceId,N'Opportunity v3.2',N'feasibility',N'Production Feasibility',N'Cost, complexity and available assets',10,N'Low');

    INSERT dbo.SchemaMigrations(Version,Name,Checksum) VALUES(N'007',N'Gap detection and scoring engines',HASHBYTES('SHA2_256',N'007:Gap detection and scoring engines'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
