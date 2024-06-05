import { GenezioDeploy } from "@genezio/types";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { connect } from "vectordb";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

export type UserDescription = {
  name: string;
  description: string;
}

export type Talks = {
  title: string;
  description: string;
  speaker: string;
  bio: string;
}

@GenezioDeploy()
export class BackendService {
  constructor() {}

  async ask(user: UserDescription): Promise<string> {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) {
        throw new Error(
          "You need to provide an OpenAI API key. Go to https://platform.openai.com/account/api-keys and save it in a `.env` file.",
        );
      }

      // Define the OpenAI model
      const model = new OpenAI({
        modelName: "gpt-4o",
        openAIApiKey: OPENAI_API_KEY,
        temperature: 0,
        verbose: true
      });

      // Define the prompt that will be fed to the model
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "ai",
          `You are a helpful assistant for ${user.name}. Based on the user description select the top 3 talks from the context that are most relevant to the user.

{context}`,
        ],
        [
          "human",
          `My name is ${user.name}. I am a ${user.description}.`,],
      ]);

      // Set the database path
      const database = "./lancedb";
      // Connect to the database
      const db = await connect(database);
      // Open the table
      const table = await db.openTable("vectors");

      // Initialize the vector store object with the OpenAI embeddings and the table
      const vectorStore = new LanceDB(new OpenAIEmbeddings(), { table });
      // Retrieve the most similar context to the input question
      const retriever = vectorStore.asRetriever(1);
      // Create an output parser that will convert the model's response to a string
      const outputParser = new StringOutputParser();

      // Create a pipeline that will feed the input question and the database retrieved context to the model
      const setupAndRetrieval = RunnableMap.from({
        context: new RunnableLambda({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          func: (input: string) => retriever.invoke(input).then((response) => response[0].pageContent),
        }).withConfig({ runName: "contextRetriever" }),
        question: new RunnablePassthrough(),
      });

      // Feed the input question and the database retrieved context to the model
      const chain = setupAndRetrieval.pipe(prompt).pipe(model).pipe(outputParser);
      // Invoke the model to answer the question
      const response = await chain.invoke(user.description);
      console.log("Answer:", response);

      return response;
    }
}
