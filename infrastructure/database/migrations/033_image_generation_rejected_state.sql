IF OBJECT_ID(N'cacsms.ImageGenerationJobs', N'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_ImageGenerationJobs_State'
      AND parent_object_id = OBJECT_ID(N'cacsms.ImageGenerationJobs')
  )
  BEGIN
    ALTER TABLE cacsms.ImageGenerationJobs DROP CONSTRAINT CK_ImageGenerationJobs_State;
  END;

  ALTER TABLE cacsms.ImageGenerationJobs
    ADD CONSTRAINT CK_ImageGenerationJobs_State
    CHECK (State IN (
      N'Waiting for Inputs', N'Queued', N'Generating', N'Uploading',
      N'Persisting', N'Validating', N'Reviewing', N'Revising',
      N'Rejected', N'Completed', N'Blocked', N'Failed'
    ));
END;

IF OBJECT_ID(N'cacsms.ImageGenerationVariants', N'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_ImageGenerationVariants_State'
      AND parent_object_id = OBJECT_ID(N'cacsms.ImageGenerationVariants')
  )
  BEGIN
    ALTER TABLE cacsms.ImageGenerationVariants DROP CONSTRAINT CK_ImageGenerationVariants_State;
  END;

  ALTER TABLE cacsms.ImageGenerationVariants
    ADD CONSTRAINT CK_ImageGenerationVariants_State
    CHECK (State IN (
      N'Waiting for Inputs', N'Queued', N'Generating', N'Uploading',
      N'Persisting', N'Validating', N'Reviewing', N'Revising',
      N'Rejected', N'Completed', N'Blocked', N'Failed'
    ));
END;
