// Centralized microcopy for Dashboard and related components
// This registry keeps all UI strings in one place for consistency and ease of updates.
// Minimal dependencies; import and use specific keys where needed.

export const MC = {
  dashboard: {
    sections: {
      upload: {
        subheader: "Bring your data to the party",
        guide:
          "Drag in a CSV or browse to upload. This is the source DataQuilt will enrich—one row at a time.",
        tooltip:
          "This is your starting line. Once uploaded, you’ll unlock CSV Preview and can wire prompts to your columns in Prompt Manager. Eg: You can upload a csv file with `customer_name`, `customer_review`, `customer_order` columns. Or a csv file with `comapany_name`, `company_location`, `company_website` columns.",
      },
      preview: {
        subheader: "Peek before you process",
        guide:
          "Confirm columns and a few sample rows. If headers look off, fix your file and re-upload.",
        tooltip:
          "The preview helps you validate column names you’ll reference in your prompts like {{Company}} or {{Customer Review}}.",
      },
      prompts: {
        subheader: "Tell the AI what to do",
        guide:
          "Use different expert types or create your own. Create prompts that run once per row individually. Use {{column_name}} to inject values from each row into your prompt.",
        tooltip:
          `Prompts are sent to the AI per row using your CSV values. You can: 
          1) Experts: Define your AI Expert by instructing the AI how to behave for each task - a cold emailer, a company researcher, a data analyst, etc.
          2) Tasks: Write the prompt that is sent to the AI for each row of your table. This is where the magic is - use {{column_name}} to inject values from each row into your prompt. Example - Summarize the {{Customer Review}} in 2 sentences for {{Customer}} who ordered {{Customer Order}}. This will make the AI respond with a summary of the customer review for each row in the table, and the responses will be stored in a new output column in your table
          3) Providers/Models: Pick a provider and LLM model to use for each task. Example - Use Perpelixty, Sonar Pro, for in-depth company researh for all {{company_name}} in your table.
          4) Output Column: The name of the new column where the AI's response will be stored. Example - {{Company Research}}
          5) Add Another Prompt to chain steps. Results land back in new columns you define. Example - Prompt 1 will generate {{Company Research}}, and Prompt 2 will analzye the {{Company Name}} based on {{Company Research}} to generate a {{Company Score}}.` 
      },
      processMonitor: {
        subheader: "Watch it run",
        guide:
          "When a job is active, you'll see per-job status, ETA, and controls (Pause/Resume when available).",
        tooltip:
          "This is your live view into row-by-row processing. Use it to catch errors early and iterate faster. (If nothing shows, click Sync Jobs.)",
      },
      syncJobs: {
        subheader: "Refresh job status",
        guide: "Click to pull the latest status from the background worker.",
        micro: "Fetch live progress.",
        tooltip:
          "Updates the Process Monitor with any new jobs, in-flight progress, or completions from the server.",
      },
    },
    errorModal: {
      title: "Job Paused Due to Error",
      description: "A critical error occurred during processing. Review the details below and take action.",
      category: {
        AUTH_ERROR: "Authentication Error",
        QUOTA_EXCEEDED: "Quota Exceeded",
        CONTENT_FILTERED: "Content Filtered",
      },
      context: {
        row: "Row",
        prompt: "Prompt",
        outputColumn: "Output Column",
        provider: "Provider",
        model: "Model",
      },
      actions: {
        resume: "Resume Job",
        stop: "Stop Job",
        dismiss: "Dismiss",
      },
      help: {
        authError: "Check your API key in Settings. The key may be invalid or expired.",
        quotaExceeded: "Check your billing status with the provider. You may need to add credits or upgrade your plan.",
        contentFiltered: "The prompt or input data triggered the provider's safety filters. Try rephrasing your prompt or adjusting the input data.",
      },
    },
    promptManager: {
      system: {
        subheader: "Optional (but recommended) rules for the AI",
        guide: "Describe how the AI Expert should behave (role, tone, format, constraints, goals, capabilities, etc.).",
        tooltip: "This instructs the AI Expert how to behave for each task. Use {{column_name}} to inject values from each row into the AI Expert defintion. Eg: 'You are the world's best cold emailer specializing in emailing procurement managers of mid-sized companies at {{company_location}}', 'You are a company researcher specializing in finding the latest news and updates about any company using high quality sources of information.'",
        buttons: {
          addVariable: {
            micro: "Insert a column placeholder.",
            tooltip:
              "Opens your column list and inserts {{column_name}} where your cursor is.",
          },
          loadSystem: {
            micro: "Reuse a saved AI Expert.",
            tooltip: "Pull a previously saved Expert instruction into this field.",
          },
          saveSystem: {
            micro: "Save this AI Expert for next time.",
            tooltip: "Store this AI Expert instruction for future prompts.",
          },
        },
      },
      user: {
        subheader: "Describe the task",
        guide:
          "Give a clear instruction for the row. Reference columns.",
        tooltip:
          "This is the action request. Keep it specific. Eg: 'Find all the relevant information about {{Company Name}} in 15-20 sentences while making sure all the important information is present.' If you chain prompts, downstream prompts can consume earlier outputs of that row. Eg: Write a personalizedemail to respond to a customer review. Customer Review: {{Customer Review}}, Company Infomration: {{Company Infomration}}",
        buttons: {
          addVariable: {
            micro: "Insert a column placeholder.",
            tooltip:
              "Same as above; inject values from the current row into your task.",
          },
          loadTask: {
            micro: "Pull a saved task.",
            tooltip: "Insert a saved task instruction to speed setup.",
          },
          saveTask: {
            micro: "One-click reuse later.",
            tooltip: "Save this task instruction to your personal library.",
          },
        },
      },
      provider: {
        subheader: "Choose your engine",
        guide: "Pick the LLM that fits your step and preferences.",
        tooltip:
          "You pay providers directly via your API keys. Mix and match providers across chained prompts for best results.",
      },
      model: {
        subheader: "Pick the right muscle",
        guide:
          "Select a model from the LLM provider tuned for the task (generation, reasoning, search-heavy, etc.).",
        tooltip:
          "Models vary in cost/quality. Start smaller, test with Preview, then scale.",
      },
      output: {
        subheader: "Name where results go",
        guide: "Enter a new or existing column name (e.g., lead_score) for the task's output.",
        tooltip:
          "Each prompt writes to its output column per row. Re-runs overwrite only if you tell them to.",
      },
      addAnotherPrompt: {
        micro: "Asseble your team of experts",
        tooltip:
          "Create a multi-step flow (e.g., enrich → classify → draft). Each step can reference previous outputs via {{prior_column}}. Eg: Prompt 1 will generate {{Company Research}}, and Prompt 2 will analzye the {{Company Name}} based on {{Company Research}} to generate a {{Company Score}}.",
        info:
          "Chaining runs prompts in order. Use it to build multi-step flows where later steps read columns written by earlier steps."
      },
    },
    global: {
      skipIfExisting: {
        subheader: "Don’t redo good work",
        guide:
          "When checked, rows with an existing output in this column won’t be re-processed.",
        tooltip:
          "Saves time and tokens for partial re-runs or when you resume after edits.",
      },
    },
    previewButton: {
      subheader: "Test before you scale",
      micro: "Run on a sample row.",
      guide:
        "Validates variable substitution, output format, and token usage.",
      tooltip:
        "Runs the current prompt chain on a sample row only—perfect for tightening instructions before full processing.",
    },
    startButton: {
      subheader: "Go from idea to output",
      micro: "Run across all rows.",
      guide:
        "Executes the prompt chain for every row in the selected CSV.",
      tooltip:
        "Starts a background job using your provider keys. Track progress in Process Monitor; adjust prompts and re-run as needed.",
    },
  },
  templatesPage: {
    header: {
      title: "Prompt Templates",
      subheader: "Create and manage reusable prompt templates for your enrichment workflows",
      guide:
        "Define task instructions and expert roles once, then reuse them across datasets. Templates let you set the AI’s role, choose providers/models, and name output columns for consistent results.",
    },
    tabs: {
      tasks: "Task Instructions",
      roles: "Expert Roles",
    },
    buttons: {
      newTask: {
        label: "New Task Instructions",
      },
      newRole: {
        label: "New Expert Role",
      },
    },
  },
  homepage: {
    hero: {
      title: "Automate AI Workflows, One Row at a Time",
      subtitle:
        "Use a team of AI experts to work on each row of your table of data, one row at a time. Instead of sending prompts one at a time, like when you use ChatGPT, configure prompt or task templates that are applied to each row of data, using values from columns you define in the prompt.",
      ctaText: "Get Started",
    },
    problem: {
      heading:
        "LLMs like ChatGPT and Perplexity can’t handle entire CSVs at once. They miss rows and fail at scale (more than just 10 rows)",
      p1: "Dumping a whole CSV into an LLM is like asking it to read a library in one breath. It stumbles.",
      p2: "DataQuilt instead runs prompts one row at a time, giving you complete, consistent results — every row, every time.",
    },
    builders: {
      title: "Build Your Workflow",
      items: [
        {
          title: "Create ‘AI Experts’",
          description:
            "Create custom roles that instruct the AI how to behave, what rules it should follow, and what your expectations are.",
          examplesTitle: "Eg:",
          examples: [
            "‘Investor Researcher’ — Specialize in finding funding priorities and recent news about investors",
            "‘Customer Support’ — Drafts personalized responses to customer comments",
            "‘Company Strategist’ — Analyzes competitor information to identify key differences",
          ],
        },
        {
          title: "Create Custom Tasks",
          description:
            "Instruct your AI expert to do whatever you need with a row of data from your file. Create prompt templates that can refer to values from {{column_names}} of your data for each row.",
          examplesTitle: "Eg:",
          examples: [
            "‘Fetch Company Information’ — Find latest news about a company from a column of company names",
            "‘Write Personalized Emails’ — Craft personalized emails to a person using columns of relevant information",
            "‘Analyze Customer Profile’ — Analyze customer preferences based on columns of customer information",
          ],
        },
        {
          title: "Enrich Your Table",
          description:
            "The AI's response to each prompt is saved in a new column in your file. This means that your input and output data all stay with you in your CSV files. Your data, your file.",
          examplesTitle: "Eg:",
          examples: [
            "‘Fetch Company Information’ → Company_Information",
            "‘Write Personalized Emails’ → Email",
            "‘Analyze Customer Profile’ → Analysis",
          ],
        },
      ],
      ctaText: "How It Works",
    },
    oneRow: {
      title: "\"One Row At A Time\"",
      subtitle:
        "Upload a CSV file, define the prompt templates with column names, and let DataQuilt handle the rest.",
      body1:
        "Define prompt templates with column names from your data. The prompt template dynamically inserts the row values and sends the prompt to an LLM, iterating row-by-row for the entire file. The response for each prompt is added in a new column in the same CSV, that you can download.",
      body2:
        "And the best part? You can send multiple prompts for each row - to different LLM providers.",
    },
    useCases: {
      title: "Make DataQuilt Work For You",
      subtitle: "Some use cases from our users",
      items: [
        {
          title: "Track the Competition",
          description:
            "Used DataQuilt as a one-click competitive tracker, instead of Googling competitors one by one.",
          bullets: [
            "Perplexity searched for the latest news and updates on each one for broad context",
            "ChatGPT screened the context to surface narrow signals we care about",
          ],
          footer: "Done automagically for 400+ competitors.",
        },
        {
          title: "Find the Right Investors",
          description: "Used DataQuilt as our one-click investor screener:",
          bullets: [
            "Perplexity gathered investor profiles with latest investments",
            "ChatGPT checked the fit with our startup",
            "ChatGPT summarized investment trends and why we fit their thesis",
          ],
          footer: "Done automagically for 300+ investors.",
        },
        {
          title: "Personalized Outreach",
          description: "Used DataQuilt as our email writer:",
          bullets: [
            "Perplexity pulled recent company news relevant to each contact from their job title and LinkedIn",
            "ChatGPT drafted a personalized email that wove in that intel",
          ],
          footer: "Done automagically for 1000+ contacts.",
        },
      ],
    },
    features: {
      title: "Built Around How You Work",
      subtitle:
        "DataQuilt gives you flexibility, speed, and control - without locking you in.",
      items: [
        {
          title: "Choose Any LLM You Need",
          description:
            "Run prompts with OpenAI, Perplexity, or Gemini. Mix and match models prompt by prompt.",
        },
        {
          title: "Pay Only What You Use",
          description:
            "Bring your own API keys. Your spend goes directly to the providers — no platform markups.",
        },
        {
          title: "Chain Prompts Into Workflows",
          description:
            "Feed the output of one prompt into the next. Create multi-step AI workflows that compound insight, not effort.",
        },
        {
          title: "Scale Without Stress",
          description:
            "Whether it's 10 rows or a million, DataQuilt processes your data reliably with real-time monitoring and control (pause, resume, stop, download anytime).",
        },
        {
          title: "Design Prompts Your Way",
          description:
            "Use dynamic variables from your CSV, mix in outputs from other prompts, and preview before running. No restrictions, because you know your data best.",
        },
        {
          title: "Stay in CSV, No Lock-In",
          description:
            "Your workflow starts with a CSV and ends with a CSV. Simple in, simple out — so your data remains portable and fully yours.",
        },
      ],
    },
    howItWorks: {
      title: "How It Works",
      subtitle:
        "A simple, reliable flow from CSV to results — designed to stay out of your way.",
      steps: [
        {
          num: 1,
          title: "Upload a CSV",
          description: "Headers and row counts are instantly loaded.",
        },
        {
          num: 2,
          title: "Write your prompt with {{columns}}",
          description:
            "Values of each column you specify are inserted into the prompt.",
        },
        {
          num: 3,
          title: "Chain prompts & pick models",
          description:
            "Add any number of prompts, choose OpenAI / Perplexity / Gemini / Deepseek per prompt, and name output columns.",
        },
        {
          num: 4,
          title: "Start processing",
          description:
            "Watch results stream back in real time. Pause/resume/stop anytime and download partial or complete CSV.",
        },
        {
          num: 5,
          title: "Row-by-row execution",
          description: "DataQuilt sends prompts one at a time for each row.",
        },
      ],
    },
    cta: {
      title: "Join the New Wave of AI Workflows",
      description:
        "Thousands of rows, hundreds of prompts, zero friction. Be part of the shift toward practical, no-lock-in AI.",
      ctaText: "Start Reducing Your Effort",
    },
  },
  howItWorksPage: {
    nav: {
      onThisPage: "On This Page",
      sections: [
        { id: "intro", label: "How It Works" },
        { id: "vs-llms", label: "DataQuilt vs LLMs" },
        {
          id: "steps",
          label: "1. Steps",
          subsections: [
            { id: "step-1", label: "Upload CSV" },
            { id: "step-2", label: "Create AI Assistant" },
            { id: "step-3", label: "Create The Task" },
            { id: "step-3-5", label: "Step 3.5: Add Prompts" },
            { id: "step-4", label: "Preview Results" },
            { id: "step-5", label: "Run Job" },
            { id: "step-6", label: "Download / Re-run" },
          ],
        },
        {
          id: "benefits",
          label: "2. Why DataQuilt",
          subsections: [
            { id: "multiple-prompts", label: "Multiple Prompts" },
            { id: "chain-prompts", label: "Chain Prompts" },
            { id: "choose-models", label: "Choose Models" },
          ],
        },
        { id: "prompts-guide", label: "3. Crafting Prompts" },
        { id: "putting-together", label: "4. Putting It Together" },
        {
          id: "api-keys",
          label: "5. API Keys & Billing",
          subsections: [
            { id: "api-what-is-key", label: "5.1 What's an API key?" },
            { id: "api-how-uses", label: "5.2 How keys are used" },
            { id: "api-get-keys", label: "5.3 Get your keys" },
            { id: "api-usage-costs", label: "5.4 Usage & costs" },
            { id: "api-add-keys", label: "5.5 Add your keys" },
          ],
        },
        { id: "faq", label: "6. FAQ" },
      ],
    },
    vsLlms: {
      heading: "DataQuilt vs LLMs",
      intro:
        "Why use DataQuilt instead of ChatGPT/Perplexity directly?",
      p1:
        "This tool is most useful when you have a spreadsheet of data, and you want to deal with each row of data individually. You might want to research the latest revenue figures for a list of companies, or the last dozen investments made by each investor of your list. Or you might want to create an email for your list of outbound prospects, personalized to each person indvidually using maximum context about them.",
      p2:
        "You won't be able to do this for a 100 - or even 10 - rows with a single prompt to ChatGPT/Perplexity etc.",
      callout:
        "That's where DataQuilt comes in. It lets you create a prompt once and run it for all the rows of your spreadsheet, one row at a time, to any LLM provider you choose.",
      note: "As of now, only .csv files work in DataQuilt.",
      tooltipSteps: [
        "Have a .csv format file ready in any accessible place in your desktop.",
        "Click on \"Upload File\" in the Dashboard",
        "Select your file and click done. You can preview your uploaded file on the Dashboard as well",
      ],
    },
    hero: {
      title: "How DataQuilt Works",
      body:
        "DataQuilt helps you turn any spreadsheet into a living, thinking dataset. Each row becomes a tiny workspace where AI can analyze, enrich, or generate insights — all automatically. Here's how it all fits together.",
    },
    steps: {
      heading: "1. Steps — From Upload to Enrichment",
      intro:
        "Using DataQuilt is as easy as stitching patterns into a quilt — one row at a time, but all at once.",
      exampleLabel: "Example",
      items: [
        {
          id: "step-1",
          number: "1",
          title: "Step 1: Upload Your CSV",
          description:
            "Start by uploading your spreadsheet — it could be a list of leads, research summaries, product reviews — any spreadsheet with any number of rows and columns. The AI's response for each row will be saved in a new column you define in the spreadsheet. Spreadsheet In -> Spreadsheet Out.",
          exampleContent:
            "You upload a file with customer feedback. Each row has a customer_name, comment, date.",
          tip: "Think of each row as a ‘thread’ that the AI will work on one at a time.",
          info:
            "Use a file containing any data you like in 3 easy steps:\n1) Have a .csv format file ready in any accessible place on your desktop.\n2) Click on 'Upload File' in the Dashboard.\n3) Select your file and click done. You can preview your uploaded file on the Dashboard as well.",
        },
        {
          id: "step-2",
          number: "2",
          title: "Step 2: Create Your AI Assistant (Optional)",
          description:
            "Define who you want your AI to be. Write down its role, behaviour, output format, what it's good for, etc. It's optional but recommended because it primes the AI to do the job you want it to do the way you want it done.",
          exampleContent:
            'Product Copywriter: “You are an expert product writer, specializing in creating funny, relatable, and easy to understand copy for e-commerce products in {{product_category}}, with audiences in {{country}}.”',
          tip:
            "You can reference row values using {{column_name}} in the assistant setup. You can save and reuse these Assistants.",
          info:
            "You will define the task in the next step. In this one, focus on shaping the AI assistant into exactly what you want it to be. You can reuse saved Assistants across tasks and providers, and insert row values in the role using {{column_name}}.",
        },
        {
          id: "step-3",
          number: "3",
          title: "Step 3: Create The Task",
          description:
            "Write down instructions for the AI to do for each row of your table. Use {{column_name}} to reference row values. Choose LLM Provider, Model, and AI Response Column Name.",
          exampleContent:
            'Prompt: "Find the top 10 features or benefits that people in {{country}} value the most about {{product_category}} based on market research and return the list with descriptions and explanations."\nLLM Provider: Perplexity\nModel: Sonar\nResponse Column Name: product_features',
          info:
            "Turn your idea into a repeatable task for every row.\n\n- Write clear instructions; reference row data with `{{column_name}}`.\n\n- Pick **LLM Provider**, **Model**, and set **AI Response Column Name** (where results will be saved).\n\n- Prefer structured outputs (lists, tables, or JSON) and give examples in the prompt.\n\n- Save this as a template if you’ll reuse it with other files.",
        },
        {
          id: "step-3-5",
          number: "3.5",
          title: "Step 3.5: Add Multiple Prompts (Chaining)",
          description:
            "Add multiple prompts sequentially for each row. Later prompts can use earlier outputs by referencing the AI response like any other column name.",
          exampleContent:
            'Prompt 2: “Create a 2-line introduction of {{product_name}} to be used in the website catalogue. This is the product description: {{product_description}}. These are the features that people value most about this product category: {{product_features}}”\nLLM Provider: ChatGPT\nModel: 4.1o\nResponse Column Name: product_introduction',
          info:
            "Chain prompts to build on each other—like steps in a recipe.\n\n- Click **Add Prompt** to create the next step.\n\n- Use outputs from earlier prompts by referencing their **AI Response Column Name** (e.g., `{{product_features}}`).\n\n- Keep names short and unique to avoid confusion across steps.\n\n- Add guardrails: If missing, return 'N/A' to keep downstream steps stable.",
        },
        {
          id: "step-4",
          number: "4",
          title: "Step 4: Preview Your Results",
          description:
            "Before running the full job, use Preview to test how your prompt performs on a few sample rows. It’s like checking one square of fabric before stitching the whole quilt.",
          tip: "A quick preview helps you fix undesired answers, formatting issues, etc early.",
          info:
            "Preview first; fix fast.\n\n- Run on a few rows to spot formatting issues or weak answers.\n\n- Tweak wording, tighten constraints, or add examples; preview again.\n\n- Aim for the exact shape you want (headings, bullets, JSON keys) before the full run.",
        },
        {
          id: "step-5",
          number: "5",
          title: "Step 5: Run Your Job",
          description:
            "Once the prompts look good, hit Run. DataQuilt will automatically process each row using your chosen AI model and display results in real time.",
          exampleContent:
            "You could summarize 10,000 reviews or categorize 5,000 leads — all in one go.",
          info:
            "Run at scale with confidence.\n\n- DataQuilt processes rows automatically and streams progress in real time.\n\n- You can monitor status, view partial results, and iterate on future runs from **Job History**.\n\n- Larger files may take longer—your prompts will be applied consistently across all rows.",
        },
        {
          id: "step-6",
          number: "6",
          title: "Step 6: Download or Re-run Anytime",
          description:
            "When done, download your enriched CSV instantly or re-run later with new prompts. Find past runs in Job History and re-run anytime.",
          info:
            "Export and iterate anytime.\n\n- Download your enriched CSV when the run finishes.",
        },
      ],
    },
    benefits: {
      heading: "2. Why DataQuilt",
      cards: [
        {
          id: "multiple-prompts",
          title: "Run Multiple Prompts at Once",
          body:
            "You can set multiple prompts to run together — like having several expert assistants working in parallel. One might analyze tone, another extract key themes, and a third summarize insights — all at the same time.",
          callout:
            "It's like having a whole research team that divides and conquers, instead of one person doing everything sequentially.",
        },
        {
          id: "chain-prompts",
          title: "Chain Prompts for Compounding Insights",
          body:
            "You can also make one prompt use the output of another. This lets you build multi-step reasoning pipelines — where each step adds depth.",
          exampleList: [
            "• Step 1: Summarize a review.",
            "• Step 2: Analyze sentiment based on that summary.",
            "• Step 3: Suggest an improvement idea using the sentiment result.",
          ],
          callout:
            "It's like baking — mix ingredients (Step 1), bake the cake (Step 2), and decorate it (Step 3). Each step uses the previous one's results.",
        },
        {
          id: "choose-models",
          title: "Choose the Right Model for Every Task",
          body:
            "DataQuilt lets you pick the best AI engine for each step. Use Perplexity Sonar Pro for real-time online research, ChatGPT-4.1 for high-quality writing, or Gemini 1.5 Pro for reasoning.",
          modelExamples: [
            { label: "Research", value: "→ Perplexity" },
            { label: "Writing", value: "→ GPT-4.1" },
            { label: "Data reasoning", value: "→ Gemini" },
          ],
          callout:
            'Just like you\'d choose different tools in a kitchen — a blender for smoothies, an oven for baking — DataQuilt lets you choose the right "AI tool" for each recipe.',
        },
      ],
    },
    promptsGuide: {
      heading: "3. Crafting Effective Prompts",
      intro:
        "Writing good prompts is like giving clear directions to a skilled assistant. The clearer and more comprehensive your instructions, the better the output.",
      cards: [
        {
          title: "Use Preview to Test Different Prompts",
          body:
            "Always start with Preview. Try different ways of phrasing your instructions and see which yields the best results. Even small wording changes can make big differences.",
          example: '"Summarize this comment" vs. "Summarize this comment in one sentence highlighting key emotion."',
          callout:
            "Think of it as a taste test — you don't serve the whole dish before tasting a spoonful.",
        },
        {
          title: 'Use "System" and "Task" Messages Together',
          intro: "Each prompt has two parts:",
          bullets: [
            '• System Message ("System") – sets the role and tone.',
            '• User Message ("Task") – gives the specific instruction.',
          ],
          example: 'System: "You are an expert data analyst."\nTask: "Classify the tone of {review_text} as Positive, Neutral, or Negative."',
          callout: "The System sets the stage; the Task gives the script.",
        },
        {
          title: "Prompt Writing Best Practices",
          intro: "Here's what works best:",
          bullets: [
            "• Be specific — vague prompts lead to vague answers.",
            "• Use examples — show what good output looks like.",
            "• Keep it comprehensive and clear — prompt instructions should be very long and detailed.",
            "• Use variables like {column_name} to personalize.",
            "• Test, tweak, repeat — the best prompts come from iteration.",
          ],
          example:
            'Instead of saying "Summarize this text," say "Summarize {text} in one sentence, focusing on the customer\'s main complaint."',
          callout: "Good prompts are like blueprints — they tell the AI exactly what to build.",
        },
      ],
    },
    puttingTogether: {
      heading: "4. Putting It All Together",
      paras: [
        "When you combine these elements — clean data, smart prompts, and the right models — DataQuilt becomes your all-in-one AI research studio.",
        "You don't just run prompts. You build workflows that think, adapt, and evolve — row by row, insight by insight.",
      ],
      summary: "In short: Upload your data. Stitch your prompts. Let DataQuilt weave the story.",
    },
    apiKeys: {
      heading: "5. API Keys & Billing — You're in Full Control",
      sections: {
        whatIsKey: {
          id: "api-what-is-key",
          title: "5.1 What’s an API key?",
          body:
            "Think of an API key like a password you generate with an AI provider and hand to DataQuilt so it can talk to that provider on your behalf. It proves permission—nothing more.",
          link: {
            label: "Explanation of API Keys",
            url: "https://www.geeksforgeeks.org/software-engineering/what-is-api-key/",
            note: "API Keys Overview",
          },
        },
        howUses: {
          id: "api-how-uses",
          title: "5.2 How DataQuilt uses your keys",
          bullets: [
            "You paste keys for the LLMs you want to use.",
            "When a job runs, DataQuilt sends your prompt to the provider you picked, using your key.",
            "Billing happens directly in your provider account; DataQuilt doesn’t add markups or usage fees.",
          ],
          summary:
            "In short: DataQuilt is the control room; your providers are the engines; your API keys are the ignition keys.",
        },
        getKeys: {
          id: "api-get-keys",
          title: "5.3 Get your API keys (with quick links)",
          providers: [
            {
              name: "OpenAI (ChatGPT / GPT models)",
              primary: { label: "OpenAI Platform", url: "https://platform.openai.com/api-keys" },
              secondary: { label: "Quick start guide", url: "https://platform.openai.com/docs/quickstart/create-and-export-an-api-key" },
            },
            {
              name: "Perplexity (Sonar / Deep Research)",
              primary: { label: "API Key Management", url: "https://docs.perplexity.ai/guides/api-key-management" },
              secondary: { label: "Pricing", url: "https://docs.perplexity.ai/guides/pricing" },
            },
            {
              name: "Google Gemini (AI Studio)",
              primary: { label: "Get API key", url: "https://aistudio.google.com/app/apikey" },
              secondary: { label: "Using Gemini API keys", url: "https://ai.google.dev/gemini-api/docs/api-key" },
            },
            {
              name: "DeepSeek",
              primary: { label: "DeepSeek Platform", url: "https://platform.deepseek.com/" },
              secondary: { label: "API Docs", url: "https://api-docs.deepseek.com/api/deepseek-api" },
            },
          ],
        },
        usageCosts: {
          id: "api-usage-costs",
          title: "5.4 What does “usage” mean? (tokens & typical costs)",
          lead:
            "LLMs bill by tokens — small chunks of text (roughly 1 token ≈ 4 characters ≈ ¾ of a word). A short paragraph (75–120 words) is often 100–160 tokens. A typical prompt+answer might be ~1,000 tokens total (e.g., 500 in + 500 out). Always confirm on the provider’s live pricing page.",
          ref: { label: "OpenAI Help Center", url: "https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them" },
          items: [
            {
              name: "Perplexity – Sonar Pro",
              estimate: "~110 prompts / $1",
              details: "Pricing: $3/M input tokens, $15/M output tokens.",
              url: "https://docs.perplexity.ai/getting-started/models/models/sonar-pro",
            },
            {
              name: "Google Gemini – 2.0 Flash",
              estimate: "~4,000 prompts / $1",
              details: "Pricing: $0.10/M input, $0.40/M output.",
              url: "https://ai.google.dev/gemini-api/docs/pricing",
            },
            {
              name: "DeepSeek – deepseek-chat (cache miss)",
              estimate: "~1,450 prompts / $1",
              details: "Pricing: $0.27/M input, $1.10/M output.",
              url: "https://api-docs.deepseek.com/quick_start/pricing-details-usd",
            },
            {
              name: "OpenAI – GPT-4o",
              estimate: "~160 prompts / $1",
              details: "Pricing: ~$2.50/M input, ~$10/M output.",
              url: "https://platform.openai.com/docs/models/gpt-4o",
            },
            {
              name: "OpenAI – GPT-4o mini",
              estimate: "~2,700 prompts / $1",
              details: "Pricing: $0.15/M input, $0.60/M output.",
              url: "https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/",
            },
          ],
        },
        addKeys: {
          id: "api-add-keys",
          title: "5.5 Add your keys to DataQuilt (once, then forget it)",
          steps: [
            "Go to Settings → API Keys in DataQuilt.",
            "Paste your keys into the matching boxes: OpenAI, Perplexity, Gemini, DeepSeek.",
            "Click Save. Your keys are stored encrypted and scoped to your account only.",
            "When you create a Task, pick the Provider and Model — DataQuilt automatically uses the right key.",
            "You can update or delete any key anytime; future runs will use the latest saved key.",
          ],
          securityNote:
            "Security note: Providers treat keys like passwords—never share them publicly.",
        },
      },
    },
    faq: {
      heading: "6. Frequently Asked Questions",
      items: [
        {
          q: "Do I need to pay DataQuilt to use it?",
          a:
            "No. DataQuilt doesn't charge for processing your data. You only pay the AI providers (OpenAI, Perplexity, Google) through your own API keys. Think of it as bringing your own electricity — DataQuilt just helps you wire it efficiently.",
        },
        {
          q: "Are my API keys safe?",
          a:
            "Yes. All keys are encrypted using AES-256-GCM, the same standard used in banking systems. They are never shared, logged, or visible to anyone else — not even the DataQuilt team. You can delete or replace them anytime.",
        },
        {
          q: "What types of files can I upload?",
          a:
            "Right now, DataQuilt supports CSV files. Each row represents a data record, and each column can be referenced in your prompts using {{column_name}}.",
        },
        {
          q: "What happens if my CSV is very large?",
          a:
            "DataQuilt processes files in the background through a real-time job system. Even large datasets (tens of thousands of rows) are handled safely and efficiently. You can track progress live and download results as soon as they're ready.",
        },
        {
          q: "Why do preview results differ from the full run?",
          a:
            "Preview tests a small sample of rows instantly using your prompts. The full run may produce slightly different answers because of randomness in LLMs or new context in each row. If you want consistent outputs, use more specific instructions or set temperature to a lower value (if your provider supports it).",
        },
        {
          q: "Can I reuse my old prompts?",
          a:
            "Yes! Every job you run is saved in Job History, and you can quickly re-run or tweak prompts without starting over. You can also create Prompt Templates to standardize workflows across multiple datasets.",
        },
        {
          q: "Can I combine different AI models in one workflow?",
          a:
            "Absolutely. You can assign a different model to each prompt — for example: Perplexity for research, GPT-4.1 for summaries, Gemini for reasoning. This mix-and-match design is one of DataQuilt's biggest strengths.",
        },
        {
          q: "Can I see how much each run costs?",
          a:
            "Yes. Since you use your own API keys, your provider dashboards (like OpenAI or Google) show exact token usage and cost. DataQuilt simply helps you run the process more efficiently — it doesn't take a cut or hide costs.",
        },
        {
          q: "What if my prompt uses a column that doesn't exist?",
          a:
            "Validation of column names is done before a run starts, with a detailed error message telling you if any thread isn't woven the right way. Check your column names carefully — they must match exactly (case-sensitive).",
        },
        {
          q: "What are some good starter use cases?",
          aLead: "Here are a few ways people use DataQuilt:",
          aList: [
            "• Summarize 10,000 survey responses.",
            "• Enrich leads with company info.",
            "• Generate personalized email drafts.",
            "• Research competitors via Perplexity.",
            "• Create AI-powered content databases.",
          ],
        },
      ],
    },
    supportCta: {
      intro: "Still stuck?",
      details:
        "Email d at dessentialist dot come. Our team is happy to help you weave your next dataset.",
    },
    a11y: {
      backToTopAria: "Back to top",
    },
  },
} as const;

export type Microcopy = typeof MC;
export type MicrocopyPaths = keyof Microcopy;


