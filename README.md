# LLM FID TXT

Generate a `llm-[fid].txt` file for any Farcaster profile. This tool helps you create a text file containing a user's profile information and their recent casts, formatted for use with language models.

> This project was scaffolded using [bhvr.dev](https://bhvr.dev)

## 🚀 Features

- Generate `llm-[fid].txt` files for any Farcaster profile
- Search by username or FID
- Customize the number of casts to include
- Sort casts by newest or oldest
- Include or exclude replies

## 🏗️ Prerequisites

- A Farcaster account (for using the application)

## 🚀 Getting Started

1. Visit [llm-fid.fun](https://llm-fid.fun)
2. Enter a Farcaster username or FID
3. Customize your options:
   - Number of casts to include (1-1000)
   - Sort order (newest or oldest)
   - Include replies (yes/no)
4. Click "Generate" to create your `llm-[fid].txt` file

## 📝 Form Options

### Search Options

- **Username**: Enter any Farcaster username
- **FID**: Enter any Farcaster ID number

### Output Options

- **Number of Casts**:
  - Enter a number to limit the output
  - Select "All" to include every cast
- **Sort Order**:
  - Newest: Most recent casts first
  - Oldest: Oldest casts first
- **Include Replies**:
  - Yes: Include all casts including replies
  - No: Only include top-level casts

## 🌐 API Usage

You can also use the API directly:

```bash
# Get a limited number of casts
GET https://api.llm-fid.fun/mcp?username=username&limit=10&sortOrder=newest&includeReplies=false

# Get all available casts
GET https://api.llm-fid.fun/mcp?username=username&sortOrder=newest&includeReplies=false&all=true
```

### API Parameters

- `username` (string, optional): Farcaster username
- `fid` (number, optional): Farcaster ID
- `limit` (number, optional): Number of casts to return (only used when all=false)
- `sortOrder` (string, optional): "newest" or "oldest"
- `includeReplies` (boolean, optional): true or false
- `all` (boolean, optional): When true, returns all available casts

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **iammatthias** - _Initial work_ - [GitHub](https://github.com/iammatthias)

## 🙏 Acknowledgments

- [Farcaster](https://farcaster.xyz) for the platform
- [bhvr.dev](https://bhvr.dev) for the monorepo starter template
