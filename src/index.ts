import { defineHook } from "@directus/extensions-sdk";
import { EventContext } from "@directus/types";
import { useEnv } from "@directus/env";
import path from "node:path";
import fsp from "node:fs/promises";
import { log } from "./log";

const TABLE = "directus_ext_email_template";

type TemplateRow = {
  template_file: string;
  template_body: string;
};

export default defineHook(({ action }, { database }) => {
  action("directus_ext_email_template.items.create", async () => {
    await sync(database);
  });

  action("directus_ext_email_template.items.update", async () => {
    await sync(database);
  });

  action("server.start", async (_, { database }) => {
    if (!(await database.schema.hasTable(TABLE))) {
      await setup(database);
      log("Setup done!");
    }

    await sync(database);
  });
});

async function setup(database: EventContext["database"]) {
  const trx = await database.transaction();
  try {
    await trx.schema.createTable(TABLE, (table) => {
      table.string("template_file").primary();
      table.text("template_body");
    });

    await trx("directus_collections").insert({
      collection: TABLE,
      hidden: true,
      singleton: false,
    });

    const seed = await (async function () {
      const templatesPath = path.resolve("./dist/services/mail/templates");
      const files = await fsp.readdir(templatesPath);
      return await Promise.all(
        files.map(async (filename) => {
          return {
            template_file: filename,
            template_body: await fsp.readFile(
              path.join(templatesPath, filename)
            ),
          };
        })
      );
    })();

    await trx("directus_fields").insert([
      {
        collection: TABLE,
        field: "template_file",
        interface: "select-dropdown",
        sort: 1,
        options: {
          choices: seed.map((entry) => ({
            text: entry.template_file,
            value: entry.template_file,
          })),
        },
      },
      {
        collection: TABLE,
        field: "template_body",
        interface: "input-code",
        sort: 2,
        options: {
          language: "plaintext",
        },
      },
    ]);

    await trx(TABLE).insert(seed);

    await trx.commit();
    log("Setup done!");
  } catch (error) {
    await trx.rollback();
    log("Setup failed!", error);
  }
  await sync(database);
}

async function sync(database: EventContext["database"]) {
  try {
    const env = useEnv();
    const destination = path.resolve(env["EMAIL_TEMPLATES_PATH"] as string);
    await fsp.mkdir(destination, { recursive: true });

    const destinationFiles = await fsp.readdir(destination);
    const templates = await database<TemplateRow>(TABLE);

    for (const template of templates) {
      await fsp.writeFile(
        path.join(destination, template.template_file),
        template.template_body
      );
    }

    for (const destinationFile of destinationFiles) {
      if (
        !templates.find(
          (template) => template.template_file === destinationFile
        )
      ) {
        await fsp.unlink(path.join(destination, destinationFile));
      }
    }
    log("Sync done!");
  } catch (error) {
    log("Sync failed!", error);
  }
}
