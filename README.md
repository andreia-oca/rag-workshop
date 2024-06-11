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

The answer to these challenges is to implement a RAG application over a pre-trained LLM. The RAG application is a two-step process:
1. **Retrieval** - the application retrieves the most relevant documents from a vector store based on the user query.
2. **Generation** - the application generates the answer based on the retrieved documents.

### Prerequisites

Create a `server/.env` file to export the OPENAI_API_KEY:

```bash
# .env
OPENAI_API_KEY="your_openai_api_key"
```

### Create a vector store

The vector store is a fancy storage for the proprietary data.

TODO - Add a diagram

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

TODO: Add diagram


### Easily deploy with Genezio


