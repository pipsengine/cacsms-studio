SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'032')
  BEGIN
    CREATE TABLE cacsms.ImageGenerationJobs (
      ImageGenerationJobId uniqueidentifier NOT NULL CONSTRAINT PK_ImageGenerationJobs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ProductionId uniqueidentifier NOT NULL,
      State nvarchar(30) NOT NULL,
      WorkerName nvarchar(200) NULL,
      ProviderName nvarchar(120) NULL,
      ModelName nvarchar(200) NULL,
      ProviderJobId nvarchar(200) NULL,
      WorkerHeartbeatAt datetimeoffset(0) NULL,
      RetryCount int NOT NULL CONSTRAINT DF_ImageGenerationJobs_RetryCount DEFAULT 0,
      FailureReason nvarchar(2000) NULL,
      NextRecoveryAction nvarchar(1000) NULL,
      StorageResult nvarchar(400) NULL,
      ModelResponseJson nvarchar(max) NULL,
      LastTransitionAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ImageGenerationJobs_LastTransitionAt DEFAULT SYSUTCDATETIME(),
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ImageGenerationJobs_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ImageGenerationJobs_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ImageGenerationJobs_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE CASCADE,
      CONSTRAINT CK_ImageGenerationJobs_State CHECK (State IN (N'Waiting for Inputs', N'Queued', N'Generating', N'Uploading', N'Persisting', N'Validating', N'Reviewing', N'Revising', N'Completed', N'Blocked', N'Failed')),
      CONSTRAINT CK_ImageGenerationJobs_RetryCount CHECK (RetryCount >= 0),
      CONSTRAINT CK_ImageGenerationJobs_ModelResponseJson CHECK (ModelResponseJson IS NULL OR ISJSON(ModelResponseJson) = 1)
    );
    CREATE INDEX IX_ImageGenerationJobs_Production_CreatedAt ON cacsms.ImageGenerationJobs(ProductionId, CreatedAt DESC);
    CREATE INDEX IX_ImageGenerationJobs_State_UpdatedAt ON cacsms.ImageGenerationJobs(State, UpdatedAt DESC);

    CREATE TABLE cacsms.ImageGenerationAssets (
      ImageGenerationAssetId uniqueidentifier NOT NULL CONSTRAINT PK_ImageGenerationAssets PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ProductionId uniqueidentifier NOT NULL,
      ImageGenerationJobId uniqueidentifier NOT NULL,
      FileName nvarchar(260) NOT NULL,
      StoragePath nvarchar(1000) NOT NULL,
      PublicUrl nvarchar(1000) NOT NULL,
      MimeType nvarchar(100) NOT NULL,
      FileSizeBytes bigint NOT NULL,
      Width int NOT NULL,
      Height int NOT NULL,
      ChecksumSha256 nvarchar(64) NOT NULL,
      AvailabilityStatus nvarchar(30) NOT NULL CONSTRAINT DF_ImageGenerationAssets_AvailabilityStatus DEFAULT N'pending',
      AvailabilityCheckedAt datetimeoffset(0) NULL,
      BrowserLoadStatus nvarchar(30) NOT NULL CONSTRAINT DF_ImageGenerationAssets_BrowserLoadStatus DEFAULT N'pending',
      BrowserLoadedAt datetimeoffset(0) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ImageGenerationAssets_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ImageGenerationAssets_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ImageGenerationAssets_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE CASCADE,
      CONSTRAINT FK_ImageGenerationAssets_Jobs FOREIGN KEY (ImageGenerationJobId) REFERENCES cacsms.ImageGenerationJobs(ImageGenerationJobId) ON DELETE CASCADE,
      CONSTRAINT CK_ImageGenerationAssets_MimeType CHECK (MimeType IN (N'image/png', N'image/webp')),
      CONSTRAINT CK_ImageGenerationAssets_FileSizeBytes CHECK (FileSizeBytes > 0),
      CONSTRAINT CK_ImageGenerationAssets_Dimensions CHECK (Width > 0 AND Height > 0),
      CONSTRAINT CK_ImageGenerationAssets_ChecksumSha256 CHECK (LEN(ChecksumSha256) = 64),
      CONSTRAINT CK_ImageGenerationAssets_AvailabilityStatus CHECK (AvailabilityStatus IN (N'pending', N'available', N'failed')),
      CONSTRAINT CK_ImageGenerationAssets_BrowserLoadStatus CHECK (BrowserLoadStatus IN (N'pending', N'loaded', N'failed'))
    );
    CREATE INDEX IX_ImageGenerationAssets_Production_CreatedAt ON cacsms.ImageGenerationAssets(ProductionId, CreatedAt DESC);
    CREATE UNIQUE INDEX UX_ImageGenerationAssets_PublicUrl ON cacsms.ImageGenerationAssets(PublicUrl);
    CREATE UNIQUE INDEX UX_ImageGenerationAssets_ChecksumSha256 ON cacsms.ImageGenerationAssets(ChecksumSha256, ProductionId);

    CREATE TABLE cacsms.ImageGenerationVariants (
      ImageGenerationVariantId uniqueidentifier NOT NULL CONSTRAINT PK_ImageGenerationVariants PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ProductionId uniqueidentifier NOT NULL,
      ImageGenerationJobId uniqueidentifier NOT NULL,
      ImageGenerationAssetId uniqueidentifier NULL,
      VariantNumber int NOT NULL,
      State nvarchar(30) NOT NULL,
      RenderPrompt nvarchar(max) NOT NULL,
      FailureReason nvarchar(2000) NULL,
      StorageResult nvarchar(400) NULL,
      ProviderResponseJson nvarchar(max) NULL,
      RetryCount int NOT NULL CONSTRAINT DF_ImageGenerationVariants_RetryCount DEFAULT 0,
      QualityScore decimal(5,2) NULL,
      QualitySummaryJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ImageGenerationVariants_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ImageGenerationVariants_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ImageGenerationVariants_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE CASCADE,
      CONSTRAINT FK_ImageGenerationVariants_Jobs FOREIGN KEY (ImageGenerationJobId) REFERENCES cacsms.ImageGenerationJobs(ImageGenerationJobId) ON DELETE CASCADE,
      CONSTRAINT FK_ImageGenerationVariants_Assets FOREIGN KEY (ImageGenerationAssetId) REFERENCES cacsms.ImageGenerationAssets(ImageGenerationAssetId),
      CONSTRAINT UQ_ImageGenerationVariants_Job_Variant UNIQUE (ImageGenerationJobId, VariantNumber),
      CONSTRAINT CK_ImageGenerationVariants_State CHECK (State IN (N'Waiting for Inputs', N'Queued', N'Generating', N'Uploading', N'Persisting', N'Validating', N'Reviewing', N'Revising', N'Completed', N'Blocked', N'Failed')),
      CONSTRAINT CK_ImageGenerationVariants_RetryCount CHECK (RetryCount >= 0),
      CONSTRAINT CK_ImageGenerationVariants_QualityScore CHECK (QualityScore IS NULL OR (QualityScore BETWEEN 0 AND 100)),
      CONSTRAINT CK_ImageGenerationVariants_ProviderResponseJson CHECK (ProviderResponseJson IS NULL OR ISJSON(ProviderResponseJson) = 1),
      CONSTRAINT CK_ImageGenerationVariants_QualitySummaryJson CHECK (QualitySummaryJson IS NULL OR ISJSON(QualitySummaryJson) = 1)
    );
    CREATE INDEX IX_ImageGenerationVariants_Production_VariantNumber ON cacsms.ImageGenerationVariants(ProductionId, VariantNumber DESC, UpdatedAt DESC);
    CREATE INDEX IX_ImageGenerationVariants_State_UpdatedAt ON cacsms.ImageGenerationVariants(State, UpdatedAt DESC);

    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ImageGenerationJobs TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ImageGenerationAssets TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ImageGenerationVariants TO [$(ApplicationUser)];

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (
      N'032',
      N'Autonomous image generation persisted assets',
      HASHBYTES('SHA2_256', N'032:Autonomous image generation persisted assets:v1')
    );
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
