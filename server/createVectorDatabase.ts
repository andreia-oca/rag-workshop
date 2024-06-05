
import * as fs from "fs";

import { OpenAIEmbeddings } from "@langchain/openai";
import * as lancedb from "vectordb";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { TextLoader} from "langchain/document_loaders/fs/text";

export async function createVectorDatabase() {
    // Set the OpenAI API key
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error(
        "You need to provide an OpenAI API key. Go to https://platform.openai.com/account/api-keys and save it in a `.env` file.",
      );
    }

    // Use the OpenAIEmbeddings model to create embeddings from text
    const embeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });

    // Set the database path
    const database = "./lancedb";

    // Create the database directory if it doesn't exist
    if (!fs.existsSync(database)) {
      try {
        fs.mkdirSync(database);
      } catch (e) {
        console.error(`Error creating directory '${database}':`, e);
      }
    }

    // Connect to the database
    const db = await lancedb.connect(database);

    // Create a table in the database called "vectors" with the schema corresponding to a TextLoader
    const table = await db.createTable(
      "vectors",
      [{ vector: Array(1536), text: "sample", source: 'string' }],
      // Overwrite the database if it already exists
      { writeMode: lancedb.WriteMode.Overwrite }
    );

    // Load the data from a text file
    const loader = new TextLoader("./data/talks.txt");
    // Load the data into documents
    const documents = await loader.load();
    // Save the data as OpenAI embeddings in a table
    const vectorStore = await LanceDB.fromDocuments(documents, embeddings, { table });

    return vectorStore;
}

(async () => {
  console.log("Creating LanceDB vector table..");
  // Create the LanceDB vector table
  await createVectorDatabase();
  console.log("Successfully created LanceDB vector table.");
})();
