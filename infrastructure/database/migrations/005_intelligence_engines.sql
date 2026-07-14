SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'005')
  BEGIN
    CREATE TABLE cacsms.IntelligenceEngineSettings (
      WorkspaceId uniqueidentifier NOT NULL,
      EngineSlug nvarchar(80) NOT NULL,
      PrimaryMarket nvarchar(150) NOT NULL CONSTRAINT DF_IntelligenceEngineSettings_Market DEFAULT N'Nigeria + West Africa',
      SignalSensitivity tinyint NOT NULL CONSTRAINT DF_IntelligenceEngineSettings_Sensitivity DEFAULT 75,
      AutoCreateOpportunities bit NOT NULL CONSTRAINT DF_IntelligenceEngineSettings_AutoCreate DEFAULT 0,
      MetricsJson nvarchar(max) NOT NULL,
      LastRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_IntelligenceEngineSettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT PK_IntelligenceEngineSettings PRIMARY KEY (WorkspaceId,EngineSlug),
      CONSTRAINT FK_IntelligenceEngineSettings_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_IntelligenceEngineSettings_Sensitivity CHECK (SignalSensitivity BETWEEN 1 AND 100),
      CONSTRAINT CK_IntelligenceEngineSettings_MetricsJson CHECK (ISJSON(MetricsJson)=1)
    );

    CREATE TABLE cacsms.IntelligenceItems (
      IntelligenceItemId uniqueidentifier NOT NULL CONSTRAINT PK_IntelligenceItems PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      EngineSlug nvarchar(80) NOT NULL,
      Title nvarchar(300) NOT NULL,
      Subtitle nvarchar(300) NULL,
      Category nvarchar(120) NOT NULL,
      Score tinyint NOT NULL,
      State nvarchar(60) NOT NULL,
      AttributesJson nvarchar(max) NOT NULL,
      IsRisk bit NOT NULL CONSTRAINT DF_IntelligenceItems_Risk DEFAULT 0,
      IsWatchlisted bit NOT NULL CONSTRAINT DF_IntelligenceItems_Watch DEFAULT 0,
      LastOpenedAt datetimeoffset(0) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_IntelligenceItems_Created DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_IntelligenceItems_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_IntelligenceItems_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_IntelligenceItems_Score CHECK (Score BETWEEN 0 AND 100),
      CONSTRAINT CK_IntelligenceItems_AttributesJson CHECK (ISJSON(AttributesJson)=1)
    );
    CREATE INDEX IX_IntelligenceItems_EngineScore ON cacsms.IntelligenceItems(WorkspaceId,EngineSlug,Score DESC,CreatedAt DESC);

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50005, 'An active workspace is required before installing intelligence engines.', 1;

    INSERT cacsms.IntelligenceEngineSettings (WorkspaceId,EngineSlug,PrimaryMarket,SignalSensitivity,MetricsJson,LastRunAt) VALUES
    (@WorkspaceId,N'global-intelligence',N'Global',78,N'[{"value":"196","label":"Global Signals","detail":"+24 this week","tone":"purple"},{"value":"38","label":"Countries Monitored","detail":"Across 6 regions","tone":"green"},{"value":"27","label":"Strategic Shifts","detail":"8 accelerating","tone":"blue"},{"value":"84%","label":"Global Opportunity Index","detail":"+6.2% this quarter","tone":"teal"}]',DATEADD(MINUTE,-5,SYSUTCDATETIME())),
    (@WorkspaceId,N'human-interest-intelligence',N'Nigeria + West Africa',82,N'[{"value":"12,846","label":"Human Signals","detail":"+1,284 today","tone":"purple"},{"value":"184","label":"Emerging Narratives","detail":"21 newly detected","tone":"green"},{"value":"68","label":"Communities Tracked","detail":"Across 14 countries","tone":"blue"},{"value":"87%","label":"Emotional Resonance","detail":"Strong engagement","tone":"coral"},{"value":"23","label":"Sensitive Issues","detail":"6 require review","tone":"orange"}]',DATEADD(MINUTE,-4,SYSUTCDATETIME())),
    (@WorkspaceId,N'mystery-intelligence',N'Africa + Global',74,N'[{"value":"642","label":"Active Mysteries","detail":"+18 this week","tone":"purple"},{"value":"97","label":"Unresolved Cases","detail":"15 high interest","tone":"blue"},{"value":"286","label":"Evidence Links","detail":"42 newly connected","tone":"green"},{"value":"81%","label":"Research Confidence","detail":"Cross-source verified","tone":"orange"},{"value":"19","label":"Credibility Risks","detail":"5 critical","tone":"red"}]',DATEADD(MINUTE,-7,SYSUTCDATETIME())),
    (@WorkspaceId,N'curiosity-engine',N'Global audiences',79,N'[{"value":"2,846","label":"Curiosity Signals","detail":"+326 today","tone":"purple"},{"value":"318","label":"Open Questions","detail":"42 newly detected","tone":"blue"},{"value":"76","label":"Knowledge Gaps","detail":"18 high potential","tone":"green"},{"value":"91%","label":"Intrigue Index","detail":"Strong audience pull","tone":"orange"},{"value":"14","label":"Integrity Risks","detail":"4 need editorial review","tone":"red"}]',DATEADD(MINUTE,-3,SYSUTCDATETIME())),
    (@WorkspaceId,N'emotional-opportunity-engine',N'West Africa',80,N'[{"value":"18,426","label":"Emotional Signals","detail":"+2,184 today","tone":"purple"},{"value":"246","label":"Unmet Needs","detail":"31 newly detected","tone":"blue"},{"value":"72","label":"Resonance Clusters","detail":"14 high potential","tone":"teal"},{"value":"88%","label":"Empathy Confidence","detail":"Cross-source aligned","tone":"orange"},{"value":"11","label":"Ethics Alerts","detail":"3 require review","tone":"red"}]',DATEADD(MINUTE,-2,SYSUTCDATETIME())),
    (@WorkspaceId,N'life-explorer-engine',N'Africa',76,N'[{"value":"4,286","label":"Life Signals","detail":"+418 today","tone":"purple"},{"value":"312","label":"Ways of Life","detail":"36 newly mapped","tone":"blue"},{"value":"94","label":"Communities","detail":"Across 18 countries","tone":"teal"},{"value":"167","label":"Story Pathways","detail":"28 production ready","tone":"orange"},{"value":"21","label":"Access Risks","detail":"7 need planning","tone":"red"}]',DATEADD(MINUTE,-5,SYSUTCDATETIME())),
    (@WorkspaceId,N'trend-intelligence',N'Global',84,N'[{"value":"1,284","label":"Active Trends","detail":"+86 this week","tone":"purple"},{"value":"94","label":"Breakout Signals","detail":"18 newly detected","tone":"blue"},{"value":"286","label":"Accelerating","detail":"+22.6% momentum","tone":"green"},{"value":"73","label":"Peaking","detail":"12 near saturation","tone":"orange"},{"value":"41","label":"Declining","detail":"9 rapid declines","tone":"red"}]',DATEADD(MINUTE,-2,SYSUTCDATETIME()));

    INSERT cacsms.IntelligenceItems (WorkspaceId,EngineSlug,Title,Subtitle,Category,Score,State,AttributesJson,IsRisk) VALUES
    (@WorkspaceId,N'global-intelligence',N'Industrial AI investment accelerating',N'Sub-Saharan Africa',N'Technology & Industry',96,N'Breakout',N'{"direction":"Positive","impact":"Very high","confidence":94,"horizon":"6-18 months","a":94,"b":96,"c":88}',0),
    (@WorkspaceId,N'global-intelligence',N'Data-centre capacity expansion',N'West Africa',N'Digital Infrastructure',92,N'Accelerating',N'{"direction":"Positive","impact":"High","confidence":91,"horizon":"12 months","a":91,"b":92,"c":89}',0),
    (@WorkspaceId,N'global-intelligence',N'EU AI compliance demand rising',N'Europe + Global exporters',N'Regulation',88,N'Act now',N'{"direction":"Mixed","impact":"High","confidence":93,"horizon":"3-12 months","a":93,"b":88,"c":84}',0),
    (@WorkspaceId,N'global-intelligence',N'Supply-chain regionalisation',N'Africa + Middle East',N'Geoeconomics',85,N'Strategic shift',N'{"direction":"Positive","impact":"High","confidence":86,"horizon":"18-36 months","a":86,"b":85,"c":82}',0),
    (@WorkspaceId,N'global-intelligence',N'Technical skills shortage widening',N'Global emerging markets',N'Workforce',83,N'Opportunity forming',N'{"direction":"Mixed","impact":"Medium-high","confidence":89,"horizon":"6-24 months","a":89,"b":83,"c":80}',0),
    (@WorkspaceId,N'global-intelligence',N'Consumer discretionary slowdown',N'Europe',N'Macroeconomics',54,N'Monitor risk',N'{"direction":"Negative","impact":"Medium","confidence":81,"horizon":"3-9 months","a":81,"b":54,"c":42}',1),

    (@WorkspaceId,N'human-interest-intelligence',N'Factory workers reskilling for an AI future',N'Lagos industrial communities',N'Work & dignity',96,N'Story ready',N'{"emotion":"Hope + uncertainty","relevance":"Very high","authenticity":94,"urgency":"High","a":96,"b":98,"c":94}',0),
    (@WorkspaceId,N'human-interest-intelligence',N'Women building clean-energy businesses',N'Northern Nigeria',N'Inclusion & enterprise',93,N'High potential',N'{"emotion":"Determination","relevance":"Very high","authenticity":92,"urgency":"Medium-high","a":93,"b":95,"c":92}',0),
    (@WorkspaceId,N'human-interest-intelligence',N'Young technicians keeping cities connected',N'West African urban centres',N'Skills & resilience',90,N'Emerging narrative',N'{"emotion":"Pride","relevance":"High","authenticity":91,"urgency":"Medium","a":90,"b":92,"c":91}',0),
    (@WorkspaceId,N'human-interest-intelligence',N'Families adapting to rising living costs',N'Nigeria + Ghana',N'Cost of living',88,N'Sensitive',N'{"emotion":"Anxiety","relevance":"Very high","authenticity":89,"urgency":"Critical","a":88,"b":94,"c":89}',1),
    (@WorkspaceId,N'human-interest-intelligence',N'Local artisans adopting digital tools',N'Aba manufacturing cluster',N'Tradition + technology',86,N'Human triumph',N'{"emotion":"Curiosity","relevance":"High","authenticity":95,"urgency":"Medium","a":86,"b":90,"c":95}',0),
    (@WorkspaceId,N'human-interest-intelligence',N'Viral hardship story with unclear origin',N'Unverified social media',N'Social hardship',48,N'Verify first',N'{"emotion":"Distress","relevance":"Medium","authenticity":42,"urgency":"Review","a":48,"b":72,"c":42}',1),

    (@WorkspaceId,N'mystery-intelligence',N'The unexplained hum beneath Lagos Island',N'Lagos, Nigeria',N'Urban anomaly',93,N'Investigation ready',N'{"evidence":"18 sources","anomaly":"High","interest":94,"credibility":88,"a":88,"b":94,"c":86}',0),
    (@WorkspaceId,N'mystery-intelligence',N'Lost iron-working settlements of the Nok',N'Central Nigeria',N'Historical archaeology',92,N'Documentary ready',N'{"evidence":"32 sources","anomaly":"Medium-high","interest":91,"credibility":94,"a":94,"b":91,"c":89}',0),
    (@WorkspaceId,N'mystery-intelligence',N'Why Lake Nyos released a deadly cloud',N'Cameroon',N'Natural phenomenon',90,N'Evidence complete',N'{"evidence":"46 sources","anomaly":"Resolved mechanism","interest":89,"credibility":98,"a":98,"b":89,"c":92}',0),
    (@WorkspaceId,N'mystery-intelligence',N'Unmapped structures beneath ancient Benin',N'Edo State, Nigeria',N'Lost infrastructure',86,N'Needs field research',N'{"evidence":"21 sources","anomaly":"High","interest":87,"credibility":82,"a":82,"b":87,"c":84}',0),
    (@WorkspaceId,N'mystery-intelligence',N'Recurring radio anomaly over the South Atlantic',N'Atlantic Ocean',N'Scientific anomaly',84,N'Expert review',N'{"evidence":"27 sources","anomaly":"Medium","interest":79,"credibility":91,"a":91,"b":79,"c":83}',0),
    (@WorkspaceId,N'mystery-intelligence',N'Viral underground-city claim',N'Unverified social media',N'Internet mystery',43,N'Credibility risk',N'{"evidence":"3 sources","anomaly":"Claimed high","interest":86,"credibility":31,"a":31,"b":86,"c":38}',1),

    (@WorkspaceId,N'curiosity-engine',N'What happens to a factory when its workers become AI trainers?',N'Industrial transformation',N'Unexpected role reversal',96,N'Develop now',N'{"novelty":96,"gap":"Very high","pull":94,"answerability":91,"a":96,"b":94,"c":91}',0),
    (@WorkspaceId,N'curiosity-engine',N'Why do some smart factories fail before they scale?',N'Automation adoption',N'Hidden failure',94,N'High potential',N'{"novelty":91,"gap":"High","pull":93,"answerability":95,"a":91,"b":93,"c":95}',0),
    (@WorkspaceId,N'curiosity-engine',N'Could Africa skip an entire industrial era?',N'Economic development',N'What if',92,N'Strategic question',N'{"novelty":94,"gap":"High","pull":91,"answerability":83,"a":94,"b":91,"c":83}',0),
    (@WorkspaceId,N'curiosity-engine',N'The invisible systems keeping Lagos alive',N'Urban infrastructure',N'Hidden world',90,N'Documentary hook',N'{"novelty":89,"gap":"Very high","pull":90,"answerability":88,"a":89,"b":90,"c":88}',0),
    (@WorkspaceId,N'curiosity-engine',N'What old crafts can teach modern AI',N'Tradition + technology',N'Surprising connection',89,N'Emerging',N'{"novelty":95,"gap":"Medium-high","pull":87,"answerability":90,"a":95,"b":87,"c":90}',0),
    (@WorkspaceId,N'curiosity-engine',N'This one secret will replace every job',N'Unverified AI claim',N'Sensational claim',44,N'Clickbait risk',N'{"novelty":42,"gap":"Artificial","pull":78,"answerability":31,"a":42,"b":78,"c":31}',1),

    (@WorkspaceId,N'emotional-opportunity-engine',N'From AI anxiety to practical confidence',N'Industrial workers and supervisors',N'Agency & security',96,N'Activate responsibly',N'{"current":"Uncertainty","desired":"Confidence","prevalence":94,"authenticity":93,"a":94,"b":97,"c":93}',0),
    (@WorkspaceId,N'emotional-opportunity-engine',N'Recognition for invisible technical workers',N'Maintenance and operations teams',N'Pride & recognition',94,N'High resonance',N'{"current":"Undervalued","desired":"Seen and respected","prevalence":89,"authenticity":96,"a":89,"b":94,"c":96}',0),
    (@WorkspaceId,N'emotional-opportunity-engine',N'Belonging for first-generation tech learners',N'Young African professionals',N'Belonging',92,N'Develop now',N'{"current":"Isolation","desired":"Community","prevalence":91,"authenticity":92,"a":91,"b":92,"c":92}',0),
    (@WorkspaceId,N'emotional-opportunity-engine',N'Relief from information overload',N'Busy enterprise leaders',N'Clarity & control',89,N'Quick win',N'{"current":"Overwhelmed","desired":"Reassured","prevalence":87,"authenticity":90,"a":87,"b":89,"c":90}',0),
    (@WorkspaceId,N'emotional-opportunity-engine',N'Hope through local innovation stories',N'Emerging-market audiences',N'Hope & possibility',87,N'Story opportunity',N'{"current":"Fatigue","desired":"Inspired","prevalence":84,"authenticity":94,"a":84,"b":87,"c":94}',0),
    (@WorkspaceId,N'emotional-opportunity-engine',N'Fear-based AI replacement messaging',N'General workforce',N'Safety',42,N'Ethics risk',N'{"current":"Fear","desired":"Artificial urgency","prevalence":78,"authenticity":34,"a":78,"b":42,"c":34}',1),

    (@WorkspaceId,N'life-explorer-engine',N'A day with the engineers who keep Lagos moving',N'Lagos, Nigeria',N'Invisible infrastructure',96,N'Expedition ready',N'{"access":"High","depth":96,"visual":94,"feasibility":88,"a":96,"b":94,"c":88}',0),
    (@WorkspaceId,N'life-explorer-engine',N'Inside Aba''s 24-hour manufacturing economy',N'Aba, Nigeria',N'Industrial community',94,N'Documentary ready',N'{"access":"Medium-high","depth":94,"visual":97,"feasibility":82,"a":94,"b":97,"c":82}',0),
    (@WorkspaceId,N'life-explorer-engine',N'Life after oil: communities building new livelihoods',N'Niger Delta',N'Economic transition',92,N'Field research',N'{"access":"Medium","depth":98,"visual":91,"feasibility":74,"a":98,"b":91,"c":74}',0),
    (@WorkspaceId,N'life-explorer-engine',N'The women running West Africa''s informal logistics',N'Nigeria + Ghana',N'Work & enterprise',91,N'High potential',N'{"access":"High","depth":95,"visual":89,"feasibility":79,"a":95,"b":89,"c":79}',0),
    (@WorkspaceId,N'life-explorer-engine',N'Night-shift technicians behind the internet',N'Regional data centres',N'Hidden profession',86,N'Access planning',N'{"access":"Restricted","depth":88,"visual":93,"feasibility":68,"a":88,"b":93,"c":68}',0),
    (@WorkspaceId,N'life-explorer-engine',N'Viral remote tribe claim without local consent',N'Unverified location',N'Exploitative trend',41,N'Ethics risk',N'{"access":"Unknown","depth":62,"visual":84,"feasibility":24,"a":62,"b":84,"c":24}',1),

    (@WorkspaceId,N'trend-intelligence',N'Agentic AI for frontline operations',N'Enterprise technology',N'Breakout',96,N'Act now',N'{"velocity":184,"adoption":"Early majority","spread":"18 markets","durability":"High","a":98,"b":94,"c":88}',0),
    (@WorkspaceId,N'trend-intelligence',N'Applied AI skills academies',N'Workforce transformation',N'Accelerating',94,N'3-12 months',N'{"velocity":126,"adoption":"Early adopters","spread":"12 markets","durability":"High","a":94,"b":92,"c":91}',0),
    (@WorkspaceId,N'trend-intelligence',N'Digital twins for African infrastructure',N'Industry 4.0',N'Emerging',91,N'6-18 months',N'{"velocity":92,"adoption":"Innovators","spread":"8 markets","durability":"Medium-high","a":91,"b":89,"c":88}',0),
    (@WorkspaceId,N'trend-intelligence',N'Local-language professional learning',N'Education media',N'Accelerating',89,N'3-9 months',N'{"velocity":78,"adoption":"Early adopters","spread":"14 markets","durability":"High","a":89,"b":90,"c":87}',0),
    (@WorkspaceId,N'trend-intelligence',N'AI-generated generic news channels',N'Content media',N'Peaking',61,N'Saturating',N'{"velocity":8,"adoption":"Late majority","spread":"Global","durability":"Low","a":61,"b":58,"c":52}',1),
    (@WorkspaceId,N'trend-intelligence',N'Generic chatbot tutorials',N'Technology content',N'Declining',42,N'Avoid',N'{"velocity":-28,"adoption":"Declining","spread":"Global","durability":"Low","a":42,"b":39,"c":35}',1);

    INSERT dbo.SchemaMigrations(Version,Name,Checksum) VALUES(N'005',N'Configurable intelligence engines',HASHBYTES('SHA2_256',N'005:Configurable intelligence engines'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
