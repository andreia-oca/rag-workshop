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

export type Recommendation = {
  speaker: string;
  reason: string;
}

const CONTEXT_DOCS_NUMBER = 15
const DATABASE_PATH = "./vectorStore";

@GenezioDeploy()
export class BackendService {
  constructor() {}

  // I am a fullstack software engineer interested in: open source, generative ai, backend technologies, cloud, cloud native, deployment, dev tools.
  // I am a product engineer interested in leadership, defining clear scopes, user experience, getting feedback
  async ask(user: UserDescription): Promise<Recommendation[]> {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error(
        "You need to provide an OpenAI API key. Go to https://platform.openai.com/account/api-keys and save it in a `.env` file.",
      );
    }

      // Connect to the database
      const db = await connect(DATABASE_PATH);

      // Open the table
      const table = await db.openTable("vectors");

      // Initialize the vector store object with the OpenAI embeddings and the table
      const vectorStore = new LanceDB(new OpenAIEmbeddings(), { table });

      // Debugging: Retrieve the most similar context to the input question
      const result = await vectorStore.similaritySearch(user.description, CONTEXT_DOCS_NUMBER);
      for (const item of result) {
        console.log("Context metadata: ", item.metadata);
        console.log("Context content: ", item.pageContent.slice(0, 10));
      }

      // Retrieve the most similar context to the input question
      const retriever = vectorStore.asRetriever(
        {
          vectorStore: vectorStore,
          k: CONTEXT_DOCS_NUMBER,
          searchType: "similarity",
          filter: {},
        },
        {
          verbose: true
        },
      );

      // Create a pipeline that will feed the input question and the database retrieved context to the model
      const setupAndRetrieval = RunnableMap.from({
        context: new RunnableLambda({
          func: (input: string) => {
            return retriever.invoke(input).then((response) => response.map(item => item.pageContent).join(' ')
          )
          }
        }).withConfig({ runName: "context" }),
        question: new RunnablePassthrough(),
      });

      // Define the prompt that will be fed to the model
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "ai",
          `Your task is to advise me on the top 3 speakers I should see at a conference.

Based on the provided user description select the top 3 speakers you would recommend to the user.
You must also mention why you selected these speakers.

You must respond as a json object with the following structure: a list of speakers with the following fields: speaker, reason.

Do not add any additional information to the response.

Respond only based on the context provided below - do not use any external information:

Context: {context}`,
        ],
        [
          "human",
          `User description: {question}`,],
      ]);

      // Define the OpenAI model
      const model = new OpenAI({
        modelName: "gpt-4o",
        openAIApiKey: OPENAI_API_KEY,
        temperature: 0.9,
        verbose: true
      });

      // Create an output parser that will convert the model's response to a string
      const outputParser = new StringOutputParser();

      // Feed the input question and the database retrieved context to the model
      const chain = setupAndRetrieval.pipe(prompt).pipe(model).pipe(outputParser);

      // Invoke the model to answer the question
      const rawResponse = await chain.invoke(
        user.description,
      );

      const response = rawResponse.replace('```json', '').replace('```', '');
      const recommendationList = JSON.parse(response) as Recommendation[];

      console.log("Recommendation list: ", recommendationList);

      return [];
    }
}
