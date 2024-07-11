# directus-extension-db-email-template

This Directus extension allows to customize email templates via Directus App/Editor.

To do so, it creates a table called `directus_ext_email_template` with two fields: `template_file` which will hold the email template filename and `template_body` which will hold the email template body (`liquid` format).

This table is automatically populated with Directus email templates after being created.

The mechanism is simple, read this table from database and write to `EMAIL_TEMPLATES_PATH` on Directus machine. This synchronization happens when server starts, or when an item on table `directus_ext_email_template` is created, updated or deleted.
