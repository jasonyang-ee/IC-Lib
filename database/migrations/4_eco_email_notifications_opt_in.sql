-- Default ECO email notifications to opt-in and disable existing users by default.
ALTER TABLE email_notification_preferences
    ALTER COLUMN notify_eco_created SET DEFAULT FALSE,
    ALTER COLUMN notify_eco_approved SET DEFAULT FALSE,
    ALTER COLUMN notify_eco_rejected SET DEFAULT FALSE,
    ALTER COLUMN notify_eco_pending_approval SET DEFAULT FALSE,
    ALTER COLUMN notify_eco_stage_advanced SET DEFAULT FALSE;

UPDATE email_notification_preferences
SET notify_eco_created = FALSE,
    notify_eco_approved = FALSE,
    notify_eco_rejected = FALSE,
    notify_eco_pending_approval = FALSE,
    notify_eco_stage_advanced = FALSE
WHERE notify_eco_created IS DISTINCT FROM FALSE
   OR notify_eco_approved IS DISTINCT FROM FALSE
   OR notify_eco_rejected IS DISTINCT FROM FALSE
   OR notify_eco_pending_approval IS DISTINCT FROM FALSE
   OR notify_eco_stage_advanced IS DISTINCT FROM FALSE;

ALTER TABLE users
    ALTER COLUMN notification_preferences SET DEFAULT '{
        "eco_submitted": false,
        "eco_approved": false,
        "eco_rejected": false,
        "eco_assigned": false
    }'::jsonb;

UPDATE users
SET notification_preferences = jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(notification_preferences, '{}'::jsonb), '{eco_submitted}', 'false'::jsonb, true),
                '{eco_approved}',
                'false'::jsonb,
                true
            ),
            '{eco_rejected}',
            'false'::jsonb,
            true
        ),
        '{eco_assigned}',
        'false'::jsonb,
        true
    )
WHERE notification_preferences IS NULL
   OR notification_preferences->>'eco_submitted' IS DISTINCT FROM 'false'
   OR notification_preferences->>'eco_approved' IS DISTINCT FROM 'false'
   OR notification_preferences->>'eco_rejected' IS DISTINCT FROM 'false'
   OR notification_preferences->>'eco_assigned' IS DISTINCT FROM 'false';