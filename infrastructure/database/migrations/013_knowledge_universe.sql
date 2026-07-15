SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'013')
  BEGIN
    CREATE TABLE cacsms.KnowledgeDomains (
      KnowledgeDomainId uniqueidentifier NOT NULL CONSTRAINT PK_KnowledgeDomains PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      ParentDomainId uniqueidentifier NULL,
      Name nvarchar(200) NOT NULL,
      Slug nvarchar(160) NOT NULL,
      Description nvarchar(1200) NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_KnowledgeDomains_Status DEFAULT N'active',
      Source nvarchar(200) NOT NULL CONSTRAINT DF_KnowledgeDomains_Source DEFAULT N'CACSMS',
      Confidence decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeDomains_Confidence DEFAULT 0,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeDomains_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeDomains_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_KnowledgeDomains_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_KnowledgeDomains_Parent FOREIGN KEY (ParentDomainId) REFERENCES cacsms.KnowledgeDomains(KnowledgeDomainId),
      CONSTRAINT UQ_KnowledgeDomains_Workspace_Slug UNIQUE (WorkspaceId, Slug),
      CONSTRAINT CK_KnowledgeDomains_Status CHECK (Status IN (N'active', N'review', N'archived')),
      CONSTRAINT CK_KnowledgeDomains_Confidence CHECK (Confidence BETWEEN 0 AND 100)
    );

    CREATE TABLE cacsms.KnowledgeRecords (
      KnowledgeRecordId uniqueidentifier NOT NULL CONSTRAINT PK_KnowledgeRecords PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      DomainId uniqueidentifier NULL,
      ParentRecordId uniqueidentifier NULL,
      RecordType nvarchar(40) NOT NULL,
      Title nvarchar(300) NOT NULL,
      Slug nvarchar(220) NOT NULL,
      Summary nvarchar(2000) NOT NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_KnowledgeRecords_Status DEFAULT N'active',
      Source nvarchar(200) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      QualityScore decimal(5,2) NOT NULL,
      LocationName nvarchar(200) NULL,
      EventDate date NULL,
      MetadataJson nvarchar(max) NULL,
      ArchivedAt datetimeoffset(0) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeRecords_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeRecords_UpdatedAt DEFAULT SYSUTCDATETIME(),
      RowVersion rowversion NOT NULL,
      CONSTRAINT FK_KnowledgeRecords_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_KnowledgeRecords_Domains FOREIGN KEY (DomainId) REFERENCES cacsms.KnowledgeDomains(KnowledgeDomainId),
      CONSTRAINT FK_KnowledgeRecords_Parent FOREIGN KEY (ParentRecordId) REFERENCES cacsms.KnowledgeRecords(KnowledgeRecordId),
      CONSTRAINT UQ_KnowledgeRecords_Workspace_Type_Slug UNIQUE (WorkspaceId, RecordType, Slug),
      CONSTRAINT CK_KnowledgeRecords_Type CHECK (RecordType IN (N'entity',N'relationship',N'collection',N'topic',N'event',N'location',N'person',N'organization',N'source',N'priority')),
      CONSTRAINT CK_KnowledgeRecords_Status CHECK (Status IN (N'active',N'verified',N'review',N'processing',N'draft',N'archived')),
      CONSTRAINT CK_KnowledgeRecords_Confidence CHECK (Confidence BETWEEN 0 AND 100),
      CONSTRAINT CK_KnowledgeRecords_Quality CHECK (QualityScore BETWEEN 0 AND 100),
      CONSTRAINT CK_KnowledgeRecords_MetadataJson CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson) = 1)
    );
    CREATE INDEX IX_KnowledgeRecords_Type_Status_Updated ON cacsms.KnowledgeRecords(RecordType, Status, UpdatedAt DESC) INCLUDE (Title, Confidence, QualityScore, DomainId);
    CREATE INDEX IX_KnowledgeRecords_Domain_Type ON cacsms.KnowledgeRecords(DomainId, RecordType) INCLUDE (Title, Status, UpdatedAt);
    CREATE INDEX IX_KnowledgeRecords_EventDate ON cacsms.KnowledgeRecords(EventDate) WHERE EventDate IS NOT NULL;

    CREATE TABLE cacsms.KnowledgeLinks (
      KnowledgeLinkId uniqueidentifier NOT NULL CONSTRAINT PK_KnowledgeLinks PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      SourceRecordId uniqueidentifier NOT NULL,
      TargetRecordId uniqueidentifier NOT NULL,
      RelationshipType nvarchar(80) NOT NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_KnowledgeLinks_Status DEFAULT N'verified',
      Source nvarchar(200) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeLinks_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeLinks_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_KnowledgeLinks_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_KnowledgeLinks_Source FOREIGN KEY (SourceRecordId) REFERENCES cacsms.KnowledgeRecords(KnowledgeRecordId),
      CONSTRAINT FK_KnowledgeLinks_Target FOREIGN KEY (TargetRecordId) REFERENCES cacsms.KnowledgeRecords(KnowledgeRecordId),
      CONSTRAINT UQ_KnowledgeLinks_Natural UNIQUE (SourceRecordId, TargetRecordId, RelationshipType),
      CONSTRAINT CK_KnowledgeLinks_Self CHECK (SourceRecordId <> TargetRecordId),
      CONSTRAINT CK_KnowledgeLinks_Status CHECK (Status IN (N'verified',N'review',N'archived')),
      CONSTRAINT CK_KnowledgeLinks_Confidence CHECK (Confidence BETWEEN 0 AND 100)
    );
    CREATE INDEX IX_KnowledgeLinks_Source ON cacsms.KnowledgeLinks(SourceRecordId, Status) INCLUDE (TargetRecordId, RelationshipType, Confidence);
    CREATE INDEX IX_KnowledgeLinks_Target ON cacsms.KnowledgeLinks(TargetRecordId, Status) INCLUDE (SourceRecordId, RelationshipType, Confidence);

    CREATE TABLE cacsms.KnowledgeAuditHistory (
      KnowledgeAuditId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_KnowledgeAuditHistory PRIMARY KEY,
      WorkspaceId uniqueidentifier NOT NULL,
      KnowledgeRecordId uniqueidentifier NULL,
      Action nvarchar(40) NOT NULL,
      BeforeJson nvarchar(max) NULL,
      AfterJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeAuditHistory_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_KnowledgeAudit_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_KnowledgeAudit_Record FOREIGN KEY (KnowledgeRecordId) REFERENCES cacsms.KnowledgeRecords(KnowledgeRecordId),
      CONSTRAINT CK_KnowledgeAudit_BeforeJson CHECK (BeforeJson IS NULL OR ISJSON(BeforeJson) = 1),
      CONSTRAINT CK_KnowledgeAudit_AfterJson CHECK (AfterJson IS NULL OR ISJSON(AfterJson) = 1)
    );
    CREATE INDEX IX_KnowledgeAudit_Record_Created ON cacsms.KnowledgeAuditHistory(KnowledgeRecordId, CreatedAt DESC);

    DECLARE @WorkspaceId uniqueidentifier = (SELECT TOP (1) WorkspaceId FROM cacsms.Workspaces ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50013, 'A workspace is required before applying Knowledge Universe reference data.', 1;

    INSERT cacsms.KnowledgeDomains (WorkspaceId, Name, Slug, Description, Status, Source, Confidence)
    VALUES
      (@WorkspaceId,N'Technology & Innovation',N'technology-innovation',N'Artificial intelligence, automation, robotics and emerging technology.',N'active',N'CACSMS reference taxonomy',97),
      (@WorkspaceId,N'Industry & Manufacturing',N'industry-manufacturing',N'Industry 4.0, manufacturing systems and infrastructure.',N'active',N'CACSMS reference taxonomy',94),
      (@WorkspaceId,N'Africa & Emerging Markets',N'africa-emerging-markets',N'Regional economies, people, organizations and opportunities.',N'active',N'CACSMS reference taxonomy',91),
      (@WorkspaceId,N'Society & Future',N'society-future',N'Workforce, policy, education and future signals.',N'review',N'CACSMS reference taxonomy',89);

    DECLARE @Technology uniqueidentifier=(SELECT KnowledgeDomainId FROM cacsms.KnowledgeDomains WHERE WorkspaceId=@WorkspaceId AND Slug=N'technology-innovation');
    DECLARE @Industry uniqueidentifier=(SELECT KnowledgeDomainId FROM cacsms.KnowledgeDomains WHERE WorkspaceId=@WorkspaceId AND Slug=N'industry-manufacturing');
    DECLARE @Africa uniqueidentifier=(SELECT KnowledgeDomainId FROM cacsms.KnowledgeDomains WHERE WorkspaceId=@WorkspaceId AND Slug=N'africa-emerging-markets');
    DECLARE @Future uniqueidentifier=(SELECT KnowledgeDomainId FROM cacsms.KnowledgeDomains WHERE WorkspaceId=@WorkspaceId AND Slug=N'society-future');

    INSERT cacsms.KnowledgeRecords (WorkspaceId,DomainId,RecordType,Title,Slug,Summary,Status,Source,Confidence,QualityScore,LocationName,EventDate,MetadataJson)
    VALUES
      (@WorkspaceId,@Technology,N'entity',N'Artificial Intelligence',N'artificial-intelligence',N'The simulation of human intelligence processes by machines, especially computer systems.',N'verified',N'Knowledge Curator',98.7,97,NULL,NULL,N'{"aliases":["AI","Machine Intelligence"],"relationships":1284,"sources":326}'),
      (@WorkspaceId,@Technology,N'entity',N'Generative AI',N'generative-ai',N'AI systems that generate text, images, code, audio and other content.',N'verified',N'Research Center',96.8,94,NULL,NULL,N'{"relationships":986,"sources":288}'),
      (@WorkspaceId,@Industry,N'entity',N'Industry 4.0',N'industry-4',N'Integrated advanced technologies for smart, connected industrial processes.',N'verified',N'Industry Source',96.2,95,NULL,NULL,N'{"relationships":764,"sources":192}'),
      (@WorkspaceId,@Africa,N'location',N'Nigeria',N'nigeria',N'A West African country with a fast-growing technology and media ecosystem.',N'verified',N'Geographic Intelligence',96.8,94,N'Abuja, Nigeria',NULL,N'{"population":"229M","signals":48}'),
      (@WorkspaceId,@Africa,N'person',N'Iyinoluwa Aboyeji',N'iyinoluwa-aboyeji',N'Founder and investor shaping African technology and venture capital.',N'verified',N'People Intelligence',94,92,N'Lagos, Nigeria',NULL,N'{"role":"Founder & General Partner","organization":"Future Africa","influence":91}'),
      (@WorkspaceId,@Africa,N'organization',N'Future Africa',N'future-africa',N'Venture capital firm investing in high-growth African technology companies.',N'verified',N'Organization Intelligence',94,96,N'Lagos, Nigeria',NULL,N'{"sector":"Venture Capital","founded":2019,"influence":91}'),
      (@WorkspaceId,@Industry,N'topic',N'How AI Is Transforming African Manufacturing',N'ai-transforming-african-manufacturing',N'AI adoption and smart-factory investment are creating strong audience interest.',N'active',N'Topic Intelligence',96,94,N'Africa',NULL,N'{"trend":38,"readiness":"Ready","productions":3}'),
      (@WorkspaceId,@Industry,N'collection',N'Industry 4.0 Evidence Library',N'industry-4-evidence-library',N'Evidence on smart factories, digital twins and industrial innovation.',N'active',N'Knowledge Repository',94,94,NULL,NULL,N'{"items":1864,"sources":97,"workflows":12}'),
      (@WorkspaceId,@Technology,N'collection',N'AI & Automation Intelligence',N'ai-automation-intelligence',N'Curated knowledge on AI technologies, automation frameworks and use cases.',N'active',N'Knowledge Repository',96,96,NULL,NULL,N'{"items":2486,"sources":142,"agents":8}'),
      (@WorkspaceId,@Future,N'event',N'ChatGPT Launch',N'chatgpt-launch',N'Public release of ChatGPT accelerated mainstream adoption of generative AI.',N'verified',N'OpenAI release evidence',99.2,98,N'San Francisco, United States','2022-11-30',N'{"impact":"Critical","sources":214,"relatedEntities":48}'),
      (@WorkspaceId,@Industry,N'source',N'AI in African Manufacturing — 2026 Outlook',N'ai-african-manufacturing-outlook',N'Verified industry outlook report used across manufacturing intelligence.',N'verified',N'Research Center',98,96,N'Africa',NULL,N'{"format":"Report PDF","owner":"Knowledge Director"}'),
      (@WorkspaceId,@Future,N'priority',N'Unify industrial skills ontology',N'unify-industrial-skills-ontology',N'Resolve conflicting workforce relationships and improve retrieval accuracy.',N'review',N'Executive Dashboard',96,91,NULL,NULL,N'{"impact":"Retrieval accuracy +12%","target":"2026-07-24"}');

    DECLARE @AI uniqueidentifier=(SELECT KnowledgeRecordId FROM cacsms.KnowledgeRecords WHERE WorkspaceId=@WorkspaceId AND RecordType=N'entity' AND Slug=N'artificial-intelligence');
    DECLARE @GenAI uniqueidentifier=(SELECT KnowledgeRecordId FROM cacsms.KnowledgeRecords WHERE WorkspaceId=@WorkspaceId AND RecordType=N'entity' AND Slug=N'generative-ai');
    DECLARE @I4 uniqueidentifier=(SELECT KnowledgeRecordId FROM cacsms.KnowledgeRecords WHERE WorkspaceId=@WorkspaceId AND RecordType=N'entity' AND Slug=N'industry-4');
    INSERT cacsms.KnowledgeLinks (WorkspaceId,SourceRecordId,TargetRecordId,RelationshipType,Status,Source,Confidence)
    VALUES (@WorkspaceId,@AI,@GenAI,N'RELATED TO',N'verified',N'Knowledge Curator',98.4),(@WorkspaceId,@AI,@I4,N'APPLIED IN',N'verified',N'Industry Source',96.7);

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (N'013', N'Knowledge Universe persistence', HASHBYTES('SHA2_256', N'013:Knowledge Universe persistence'));
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
