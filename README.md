# Generative AI - RAG Workshop

This repository contains the source code for the workshop *"Can LLMs Learn? Let’s Customize an LLM to Chat With Your Own Data"* held at [C3 Festival 2024](https://c3fest.com/).

The application is a RAG application that takes as an input the user description and interests and generates a list of must-see speakers from C3 Festival.

Feel free to fork it and use it as a template for your own projects.

<div style="display: flex; align-items: center;">
  <a href="https://gitpod.io/#https://github.com/andreia-oca/rag-workshop" style="margin-right: 10px;">
    <img src="https://gitpod.io/button/open-in-gitpod.svg" alt="Open in Gitpod" style="height: 30px;"/>
  </a>
  <!-- <a href="https://open.vscode.dev/andreia-oca/rag-workshop" style="margin-right: 10px;">
    <img src="https://img.shields.io/static/v1?label=Open%20in%20VSCode&message=Open&color=blue&logo=visualstudiocode" alt="Open in Visual Studio Code" style="height: 30px;"/>
  </a> -->
  <a href="https://codespaces.new/andreia-oca/rag-workshop">
    <img src="https://github.com/codespaces/badge.svg" alt="Open in GitHub Codespaces" style="height: 30px;"/>
  </a>
</div>

## Step-by-step tutorial

LLMs challenges are:
1. **Adding new or proprietary data** - LLMs are trained on public tokens (public data from the Internet) up to a certain date. If you want to add new data, you need to retrain the model or to provide the information in the prompt.
2. **Costs** - each prompt cost increases with the number of tokens in the prompt. The longer the prompt, the more expensive it is.

### Prerequisites

Create a `server/.env` file to export the OPENAI_API_KEY:

```bash
# .env
OPENAI_API_KEY="your_openai_api_key"
```

### Create a vector store

The vector store is a fancy storage for the proprietary data.

Load the data into documents:

```typescript
    // Document loading
    const loader = new TextLoader("./data/talks.txt");
    const raw_documents = await loader.load();
    console.log(raw_documents.length);
    console.log(raw_documents[0].length);
```

Split the data into more manageable chunks:

```typescript
    // Document splitting
    const splitter = new RecursiveCharacterTextSplitter({
        separators: ["\n\n", "\n", ",", " ", ""],
        chunkSize: 1024,
        chunkOverlap: 256,
    });

    const documents = await splitter.splitDocuments(raw_documents);
    console.log(documents.length);
```

Create the vector store/vector database:

```typescript
    // Use the OpenAIEmbeddings model to create embeddings from text
    const embeddings = new OpenAIEmbeddings({openAIApiKey: OPENAI_API_KEY});

    // Create the database directory if it doesn't exist
    if (!fs.existsSync(DATABASE_PATH)) {
      try {
        fs.mkdirSync(DATABASE_PATH);
      } catch (e) {
        console.error(`Error creating directory '${DATABASE_PATH}':`, e);
      }
    }

    // Connect to the vector store
    const db = await lancedb.connect(DATABASE_PATH);
```

Set the vector schema - highly dependant on how the documents metadata looks like:

```typescript
    const table = await db.createTable(
      "vectors",
      [
        {
          vector: await embeddings.embedQuery("string"),
          text: "contents",
          source: "filename",
          loc: { lines: { from: 0, to: 0 } },
        },
      ],
      { writeMode: lancedb.WriteMode.Overwrite }
    );
```

Save the embeddings in the vector store:

```typescript
    // Save the data as OpenAI embeddings in a table
    await LanceDB.fromDocuments(documents, embeddings, { table });
```

### Retrieve data based on a question


Open the vector database:
```ts
      // Connect to the database
      const db = await connect(DATABASE_PATH);

      // Open the table
      const table = await db.openTable("vectors");

      // Initialize the vector store object with the OpenAI embeddings and the table
      const vectorStore = new LanceDB(new OpenAIEmbeddings(), { table });
```

Optional, for debugging purposes, you can run a similarity search to understand which data is relevant to the question from the vector database.
This data will be added as a context in the final prompt:
```ts
      // Debugging: Retrieve the most similar context to the input question
      const result = await vectorStore.similaritySearch(user.description, CONTEXT_DOCS_NUMBER);
      for (const item of result) {
        console.log("Context metadata: ", item.metadata);
        console.log("Context content: ", item.pageContent.slice(0, 10));
      }
```

Create the pipeline that will construct the final prompt. The data retrieved will be pasted instead of `{context}` and the `{question}` will be the actual user description:
```
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
```

Initialize the model:
```
      // Define the OpenAI model
      const model = new OpenAI({
        modelName: "gpt-4o",
        openAIApiKey: OPENAI_API_KEY,
        temperature: 0.9,
        verbose: true
      });
```

Lastly, the chain is completed by mentioning an output parser. In our case the output will be a simple string.
```ts
      // Create an output parser that will convert the model's response to a string
      const outputParser = new StringOutputParser();
```

Run the chain:
```ts
      // Feed the input question and the database retrieved context to the model
      const chain = setupAndRetrieval.pipe(prompt).pipe(model).pipe(outputParser);

      // Invoke the model to answer the question
      const rawResponse = await chain.invoke(
        user.description,
      );
```

Lastly, manipulate the data to make sure we can parse it as a JSON in the frontend.
```ts
      const response = rawResponse.replace('```json', '').replace('```', '');
      const recommendationList = JSON.parse(response) as Recommendation[];
```

### Easily deploy with Genezio

You can either locally test your fullstack application by running:
```bash
genezio local
```

Or you can deploy it to production by running:
```bash
genezio deploy
```

The last command will give you a publicly available URL where your app is deployed.

## Support

Feel free to use this repository as a starting point for implementing your on RAG application over OpenAI API.

If you encounter any issues, please leave a [GitHub issue] and I'll try to help you.

## Resources

- https://genezio.com/docs/
- https://learn.deeplearning.ai/courses/langchain-chat-with-your-data/

