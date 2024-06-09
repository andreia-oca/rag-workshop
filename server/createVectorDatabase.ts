
import * as fs from "fs";

import { OpenAIEmbeddings } from "@langchain/openai";
import * as lancedb from "vectordb";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { TextLoader} from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import dotenv from "dotenv";
dotenv.config();

const DATABASE_PATH = "./vectorStore";

export async function createVectorDatabase() {
    // Set the OpenAI API key
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error(
        "You need to provide an OpenAI API key. Go to https://platform.openai.com/account/api-keys and save it in a `.env` file.",
      );
    }

    // Document loading
    const loader = new TextLoader("./data/talks.txt");
    const raw_documents = await loader.load();
    console.log("Documents length: ", raw_documents.length)

    // Document splitting
    const splitter = new RecursiveCharacterTextSplitter({
      separators: ["\n\n", "\n", ",", " ", ""],
      chunkSize: 1024,
      chunkOverlap: 256,
    });
    const documents = await splitter.splitDocuments(raw_documents);
    console.log("Splitted documents length: ", documents.length)

    // Use the OpenAIEmbeddings model to create embeddings from text
    const embeddings = new OpenAIEmbeddings({openAIApiKey: OPENAI_API_KEY});

    // Create the vector store directory if it doesn't exist
    if (!fs.existsSync(DATABASE_PATH)) {
      try {
        fs.mkdirSync(DATABASE_PATH);
      } catch (e) {
        console.error(`Error creating directory '${DATABASE_PATH}':`, e);
      }
    }

    // Connect to the vector store
    const db = await lancedb.connect(DATABASE_PATH);

    // Create a table in the vector store with a specific schema
    const table = await db.createTable(
      "vectors",
      [
        {
          vector: await embeddings.embedQuery("string"),
          text: "",
          source: "",
          loc: { lines: { from: 0, to: 0 } },
        },
      ],
      // Overwrite the table if it already exists
      { writeMode: lancedb.WriteMode.Overwrite }
    );

    // Save the data as OpenAI embeddings in a table
    await LanceDB.fromDocuments(documents, embeddings, { table });
}

(async () => {
  console.log("Creating the vector store...");
  await createVectorDatabase();
  console.log("Successfully saved embeddings in the vector store.");
})();
