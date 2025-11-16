# DataQuilt

> A lightweight, efficient platform for enriching CSV data using multiple LLM providers.

DataQuilt helps you turn any spreadsheet into a living, thinking dataset. Each row becomes a workspace where AI can analyze, enrich, or generate insights — all automatically.

## ✨ Features

- **Multi-Provider LLM Support**: OpenAI GPT, Google Gemini, Perplexity Sonar, and DeepSeek
- **Real-Time Processing**: Live job monitoring with progress tracking and control
- **Secure API Key Management**: AES-256-GCM encryption for user API keys
- **Template System**: Reusable prompt templates with variable substitution
- **Prompt Chaining**: Use outputs from previous prompts as inputs for subsequent ones
- **Skip Existing Values**: Option to skip processing rows that already have values
- **Real-Time Updates**: Live progress tracking via Supabase Realtime
- **Secure Authentication**: Google OAuth 2.0 with Supabase integration

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL database (or Supabase account)
- Supabase project for auth and storage
- At least one LLM provider API key (OpenAI, Gemini, Perplexity, or DeepSeek)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dessentialist/DataQuilt.git
   cd DataQuilt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the project root and configure it using the
   environment reference in `DEPLOYMENT.md` (required variables, optional
   flags, and recommended defaults). This file is intentionally not tracked
   in git.

4. **Run database migrations**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`.

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design patterns
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide for various platforms
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[SECURITY.md](./SECURITY.md)** - Security policy and reporting

## 🏗️ Architecture

DataQuilt follows a three-tier architecture:

- **Presentation Layer**: React SPA with TypeScript and Tailwind CSS
- **Application Layer**: Express.js API with business logic
- **Data Layer**: PostgreSQL with Supabase for auth, storage, and real-time

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn/UI
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth with Google OAuth
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime
- **LLM Integration**: LangChain with multiple providers

## 📖 How It Works

1. **Upload CSV**: Upload your data file with structured rows
2. **Create Prompts**: Write prompts with `{{variable}}` placeholders for row values
3. **Preview**: Test your prompts on sample rows before running the full job
4. **Run Job**: Process all rows automatically with real-time progress tracking
5. **Download**: Get your enriched CSV with AI-generated insights

For a detailed walkthrough, visit the [How It Works](./content/How%20It%20Works.md) guide.

## 🔐 Security

- API keys are encrypted using AES-256-GCM
- Row-level security for user data isolation
- JWT-based authentication with secure session management
- Input validation and CSRF protection

See [SECURITY.md](./SECURITY.md) for security details and vulnerability reporting.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [LangChain](https://www.langchain.com/) for LLM orchestration
- [Supabase](https://supabase.com/) for backend services
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations
- [Shadcn/UI](https://ui.shadcn.com/) for UI components

## 📧 Support

For questions, issues, or contributions, please open an issue on GitHub.

---

Made with ❤️ by the DataQuilt team

