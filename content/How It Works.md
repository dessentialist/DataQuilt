# 🧵 How DataQuilt Works

DataQuilt helps you turn any spreadsheet into a living, thinking dataset.  
Each row becomes a tiny workspace where AI can analyze, enrich, or generate insights — all automatically.  
Here’s how it all fits together.

---

## 🪡 1. Steps — From Upload to Enrichment

Using DataQuilt is as easy as stitching patterns into a quilt — one row at a time, but all at once.

### Step 1: Upload Your CSV
Start by uploading your data file — it could be a list of leads, research summaries, product reviews, or anything with structured rows.  
Think of it as giving each row a “thread” the AI will work with.

> 💡 Example:  
> You upload a file with customer feedback. Each row has a `customer_name`, `comment`, `date`.



### Step 2: Create Your Prompt Template

Write a prompt the AI will run **for each row**.  
Use placeholders like `{{column_name}}` to pull row values.  
Set an **Output Column** for where the answer will go.

> 💡 **Example prompt**  
> “Summarize the key emotion in `{{comment}}` in one word.”
> **Output Column**: `comment_emotion`

You can add **multiple prompts**. Later prompts can use earlier outputs:
> 💡 💡 **Chaining example**  
> “Based on `{{comment_emotion}}`, write a one-sentence reply to `{{customer_name}}`.”


### Step 3: Preview Your Results
Before running the full job, use **Preview** to test how your prompt performs on a few sample rows.  
It’s like checking one square of fabric before stitching the whole quilt.

> ✨ Tip: A quick preview helps you fix undesirded answers, formatting issues, etc early.


### Step 4: Run Your Job
Once the prompts looks good, hit **Run**.  
DataQuilt will automatically process each row, using your chosen AI model — OpenAI, Perplexity, or Google — and display results in real time.

> 🧠 Example:  
> You could summarize 10,000 reviews or categorize 5,000 leads — all in one go.


### Step 5: Download or Re-run Anytime
When done, you can download your enriched CSV instantly or re-run the same job later with new prompts. Find past runs in **Job History** and **Re-Run** with updated prompts anytime.
Everything stays saved in your **Job History**.


---

## 🪶 2. Benefits — Why DataQuilt Is So Powerful

### 🧩 1. Run Multiple Prompts at Once
You can set **multiple prompts** to run together — like having several expert assistants working in parallel.  
One might analyze tone, another extract key themes, and a third summarize insights — all at the same time.

> 💬 It’s like having a whole research team that divides and conquers, instead of one person doing everything sequentially.


### 🔁 2. Chain Prompts for Compounding Insights
You can also make one prompt use the **output of another**.  
This lets you build **multi-step reasoning** pipelines — where each step adds depth.

> 💡 Example:  
> - Step 1: Summarize a review.  
> - Step 2: Analyze sentiment based on that summary.  
> - Step 3: Suggest an improvement idea using the sentiment result.

> 🧠 It’s like baking — mix ingredients (Step 1), bake the cake (Step 2), and decorate it (Step 3).  
> Each step uses the previous one’s results.


### ⚙️ 3. Choose the Right Model for Every Task
DataQuilt lets you **pick the best AI engine** for each step.  
Use **Perplexity Sonar Pro** for real-time online research, **ChatGPT-4.1** for high-quality writing, or **Gemini 1.5 Pro** for reasoning.

> 💡 Example:  
> Research → Perplexity  
> Writing → GPT-4.1  
> Data reasoning → Gemini

> ⚖️ Just like you’d choose different tools in a kitchen — a blender for smoothies, an oven for baking — DataQuilt lets you choose the right “AI tool” for each recipe.

---

## 🧭 3. Crafting Effective Prompts

Writing good prompts is like giving clear directions to a skilled assistant.  
The clearer and more comprehensive your instructions, the better the output.


### 🧪 1. Use Preview to Test Different Prompts
Always start with **Preview**.  
Try different ways of phrasing your instructions and see which yields the best results.  
Even small wording changes can make big differences.

> 💬 Example:  
> “Summarize this comment” vs. “Summarize this comment in one sentence highlighting key emotion.”

> 🧠 Think of it as a taste test — you don’t serve the whole dish before tasting a spoonful.


### 💬 2. Use “System” and “Task” Messages Together
Each prompt has two parts:
- **System Message (“System”)** – sets the role and tone.  
- **User Message (“Task”)** – gives the specific instruction.

> 💡 Example:
> - System: “You are an expert data analyst.”  
> - Task: “Classify the tone of `{review_text}` as Positive, Neutral, or Negative.”

> 🎨 Analogy: The System sets the stage; the Task gives the script.


### 🪞 3. Prompt Writing Best Practices

Here’s what works best:
- Be **specific** — vague prompts lead to vague answers.  
- Use **examples** — show what good output looks like.  
- Keep it **comprehensive and clear** — prompt instructions should be very long and detailed.  
- Use **variables** like `{column_name}` to personalize.  
- Test, tweak, repeat — the best prompts come from iteration.

> 💡 Example:  
> Instead of saying *“Summarize this text,”* say *“Summarize `{text}` in one sentence, focusing on the customer’s main complaint.”*

> 🧩 Analogy: Good prompts are like blueprints — they tell the AI exactly what to build.


---

## 🌈 Putting It All Together

When you combine these elements — clean data, smart prompts, and the right models —  
DataQuilt becomes your all-in-one AI research studio.

You don’t just run prompts.  
You *build workflows* that think, adapt, and evolve — row by row, insight by insight.  

> 🪡 In short: Upload your data. Stitch your prompts. Let DataQuilt weave the story.

---

## 🔑 4. API Keys & Billing — You’re in Full Control

DataQuilt doesn’t charge you for usage.  
You connect your own API keys, and you pay only the AI providers directly for what you use — nothing more.

### Step 1: Add Your API Keys
Go to **Settings → API Keys**.  
You’ll see fields for OpenAI, Perplexity, and Google Gemini.  
Paste your key into the right box and click **Save**.

> 🔒 Each key is encrypted using AES-256-GCM and stored securely — only your account can access it.


### Step 2: Choose Keys When You Run Jobs
When setting up a prompt, pick which model (and therefore which key) you want to use.  
DataQuilt automatically routes the request through your selected provider.

> 💡 Example:  
> - Summarization → GPT-4.1 (OpenAI key)  
> - Research → Sonar Pro (Perplexity key)  
> - Reasoning → Gemini (Google key)

### Step 3: Pay Only for What You Use
Every call is made **from your own API account**.  
That means:
- You’re billed **directly by the provider** (OpenAI, Perplexity, or Google).  
- You see exactly what each job costs — no markups, no hidden fees.  
- You can pause, swap, or delete keys anytime.

> 💬 Think of DataQuilt as your AI command center — it runs your instructions but never touches your wallet.

---

## ❓ 5. FAQ 

### 🧵 1. Do I need to pay DataQuilt to use it?
No. DataQuilt doesn’t charge for processing your data.  
You only pay the AI providers (OpenAI, Perplexity, Google) through your own API keys.  
Think of it as bringing your own electricity — DataQuilt just helps you wire it efficiently.


### 🔑 2. Are my API keys safe?
Yes. All keys are encrypted using **AES-256-GCM**, the same standard used in banking systems.  
They are never shared, logged, or visible to anyone else — not even the DataQuilt team.  
You can delete or replace them anytime.


### 📁 3. What types of files can I upload?
Right now, DataQuilt supports **CSV files**.  
Each row represents a data record, and each column can be referenced in your prompts using `{{column_name}}`.


### 🧠 4. What happens if my CSV is very large?
DataQuilt processes files in the background through a **real-time job system**.  
Even large datasets (tens of thousands of rows) are handled safely and efficiently.  
You can track progress live and download results as soon as they’re ready.

### ⚙️ 5. Why do preview results differ from the full run?
**Preview** tests a small sample of rows instantly using your prompts.  
The full run may produce slightly different answers because of randomness in LLMs or new context in each row.  
If you want consistent outputs, use more specific instructions or set temperature to a lower value (if your provider supports it).

### 🔁 6. Can I reuse my old prompts?
Yes! Every job you run is saved in **Job History**, and you can quickly re-run or tweak prompts without starting over.  
You can also create **Prompt Templates** to standardize workflows across multiple datasets.


### 🧩 7. Can I combine different AI models in one workflow?
Absolutely.  
You can assign a different model to each prompt — for example:  
Perplexity for research, GPT-4.1 for summaries, Gemini for reasoning.  
This mix-and-match design is one of DataQuilt’s biggest strengths.


### 📊 8. Can I see how much each run costs?
Yes. Since you use your own API keys, your provider dashboards (like OpenAI or Google) show exact token usage and cost.  
DataQuilt simply helps you run the process more efficiently — it doesn’t take a cut or hide costs.


### 🧩 9. What if my prompt uses a column that doesn’t exist?
Validation of column names is done before preview and before a run starts. During Preview, any output/header name collision is treated as an error and blocks the preview so you can adjust safely. When starting a job, collisions are treated as warnings — you’ll see a confirmation that clearly lists which output column names match your input headers and, if you proceed, those input columns will be overwritten in the enriched output.
Check your column names carefully — they must match exactly (case-sensitive).

### 🧰 10. What are some good starter use cases?
Here are a few ways people use DataQuilt:
- Summarize 10,000 survey responses.  
- Enrich leads with company info.  
- Generate personalized email drafts.  
- Research competitors via Perplexity.  
- Create AI-powered content databases.


> Still stuck?  
> Email **d at dessentialist dot come**.  
> Our team is happy to help you weave your next dataset.

---