SET NOCOUNT ON; SET XACT_ABORT ON;
BEGIN TRY BEGIN TRANSACTION;
IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'008')
BEGIN
 CREATE TABLE cacsms.ContentIntelligenceRecords(
  ContentRecordId uniqueidentifier NOT NULL CONSTRAINT PK_ContentIntelligenceRecords PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  WorkspaceId uniqueidentifier NOT NULL, PageSlug nvarchar(100) NOT NULL, Title nvarchar(300) NOT NULL,
  Subtitle nvarchar(400) NULL, Category nvarchar(120) NOT NULL, Score tinyint NOT NULL, Status nvarchar(80) NOT NULL,
  AttributesJson nvarchar(max) NOT NULL CONSTRAINT DF_ContentIntelligenceRecords_Attributes DEFAULT N'{}',
  CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ContentIntelligenceRecords_Created DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ContentIntelligenceRecords_Updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_ContentIntelligenceRecords_Workspaces FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
  CONSTRAINT CK_ContentIntelligenceRecords_Score CHECK(Score BETWEEN 0 AND 100),
  CONSTRAINT CK_ContentIntelligenceRecords_Attributes CHECK(ISJSON(AttributesJson)=1)
 );
 CREATE INDEX IX_ContentIntelligenceRecords_Page ON cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Score DESC);
 DECLARE @w uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
 INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson) VALUES
 (@w,N'topic-discovery',N'AI Agents Transforming African Manufacturing',N'Technology · Industry 4.0',N'Topic',94,N'High potential',N'{"demand":"Very High","velocity":184}'),
 (@w,N'topic-discovery',N'Why Smart Factories Fail Before They Scale',N'Business · Automation',N'Topic',91,N'Rising',N'{"demand":"High","velocity":92}'),
 (@w,N'research-workspace',N'AI in Nigerian Manufacturing',N'Documentary research',N'Research project',78,N'In progress',N'{"progress":78}'),
 (@w,N'research-workspace',N'Digital Twins for Industrial Automation',N'Curriculum research',N'Research project',64,N'Agent working',N'{"progress":64}'),
 (@w,N'source-analysis',N'World Economic Forum – Future of Jobs 2025',N'Institutional report',N'Source',96,N'Trusted',N'{"authority":98}'),
 (@w,N'source-analysis',N'McKinsey – State of AI',N'Industry research',N'Source',93,N'Trusted',N'{"authority":94}'),
 (@w,N'fact-verification',N'AI could add $15.7 trillion to the global economy',N'Economic impact',N'Claim',96,N'Verified',N'{"sources":3}'),
 (@w,N'fact-verification',N'Predictive maintenance cuts downtime by 30–50%',N'Operational benefit',N'Claim',92,N'Verified',N'{"sources":4}'),
 (@w,N'knowledge-extraction',N'Industrial AI adoption is accelerating',N'Digital Transformation',N'Key Insight',96,N'Graph ready',N'{"confidence":96}'),
 (@w,N'knowledge-extraction',N'Predictive maintenance',N'Operations',N'Concept Entity',98,N'Resolved',N'{"confidence":98}'),
 (@w,N'citation-manager',N'World Economic Forum (2025) – Future of Jobs Report',N'18 linked claims',N'Citation',92,N'Valid',N'{"claims":18}'),
 (@w,N'citation-manager',N'PwC Global AI Study',N'11 linked claims',N'Citation',87,N'Valid',N'{"claims":11}'),
 (@w,N'trend-intelligence',N'Agentic AI for Business Operations',N'Technology',N'Trend',96,N'Breakout',N'{"velocity":184}'),
 (@w,N'trend-intelligence',N'Digital Twins in Construction',N'Industry 4.0',N'Trend',91,N'Accelerating',N'{"velocity":92}'),
 (@w,N'audience-research',N'Operations & Plant Managers',N'Industrial decision-makers',N'Audience',91,N'High intent',N'{"reach":412000}'),
 (@w,N'audience-research',N'African Technology Professionals',N'Career growth audience',N'Audience',89,N'High intent',N'{"reach":1200000}'),
 (@w,N'competitor-intelligence',N'ColdFusion',N'Technology documentaries',N'Competitor',92,N'Strong authority',N'{"views":8400000}'),
 (@w,N'competitor-intelligence',N'Business Insider Africa',N'Business & industry',N'Competitor',86,N'High frequency',N'{"views":1800000}'),
 (@w,N'content-gap-analysis',N'How AI agents coordinate factory maintenance',N'AI Operations',N'Content gap',94,N'Priority',N'{"demand":"Very High"}'),
 (@w,N'content-gap-analysis',N'Practical digital twins for Nigerian SMEs',N'Industrial Technology',N'Content gap',92,N'Quick win',N'{"demand":"High"}'),
 (@w,N'curriculum-research',N'AI Automation for Business Leaders',N'Executive programme',N'Curriculum',90,N'In review',N'{"modules":8}'),
 (@w,N'curriculum-research',N'Industrial Digital Transformation',N'Professional course',N'Curriculum',86,N'Researching',N'{"modules":12}'),
 (@w,N'source-library',N'The Future of Jobs Report 2025',N'WEF',N'Institutional report',96,N'Trusted',N'{"format":"PDF"}'),
 (@w,N'source-library',N'State of AI 2026',N'McKinsey',N'Industry research',93,N'Trusted',N'{"format":"PDF"}'),
 (@w,N'knowledge-base',N'Industrial AI',N'Artificial Intelligence',N'Concept',98,N'Healthy',N'{"connections":4218}'),
 (@w,N'knowledge-base',N'Smart Manufacturing',N'Industrial Automation',N'Entity',95,N'Healthy',N'{"connections":3846}'),
 (@w,N'intelligence-reports',N'Weekly Content Opportunity Brief',N'Trend + gap intelligence',N'Report',94,N'Ready',N'{"shared":false}'),
 (@w,N'intelligence-reports',N'African Industrial AI Landscape',N'Market intelligence',N'Report',91,N'Shared',N'{"shared":true}');
 INSERT dbo.SchemaMigrations(Version,Name,Checksum) VALUES(N'008',N'Content intelligence records',HASHBYTES('SHA2_256',N'008:Content intelligence records'));
END
COMMIT TRANSACTION; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
