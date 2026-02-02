# My Genealogical Tree

A comprehensive web application for creating and managing family genealogical trees with visual representations, user authentication, and automatic matching between users' trees.

## Features

- 🔐 **User Authentication**: Secure registration and login system
- 👥 **Person Management**: Add, edit, and delete family members with detailed information
- 📸 **Photo Integration**: Upload and display photos for each family member
- 🌳 **Visual Tree View**: Interactive graphical representation of family relationships
- 🔍 **Automatic Matching**: Discover potential connections between your tree and other users
- 💾 **Data Persistence**: MongoDB database for reliable data storage
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

### Backend
- Node.js & Express
- MongoDB with Mongoose
- JWT for authentication
- Multer for file uploads
- bcryptjs for password hashing

### Frontend
- React with Vite
- React Router for navigation
- React-D3-Tree for visual tree rendering
- Axios for API calls
- Modern CSS for styling

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/denisbilli/my-genealogical-tree.git
   cd my-genealogical-tree
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - `PORT`: Server port (default: 5000)
   - `MONGODB_URI`: MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT tokens (use a strong random string)
   - `NODE_ENV`: Environment (development/production)

5. **Start MongoDB**
   Make sure MongoDB is running on your system:
   ```bash
   # macOS with Homebrew
   brew services start mongodb-community
   
   # Linux with systemd
   sudo systemctl start mongod
   
   # Or run directly
   mongod
   ```

## Usage

### Development Mode

1. **Start the backend server**
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:5000`

2. **Start the frontend development server** (in a new terminal)
   ```bash
   npm run client
   ```
   The application will open at `http://localhost:3000`

### Production Mode

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Start the server**
   ```bash
   NODE_ENV=production npm start
   ```

The application will serve both frontend and backend from port 5000.

## Project Structure

```
my-genealogical-tree/
├── server/
│   ├── config/          # Database configuration
│   ├── models/          # Mongoose models (User, Person)
│   ├── routes/          # API routes (auth, persons)
│   └── middleware/      # Auth middleware
├── client/
│   ├── src/
│   │   ├── components/  # React components (PersonModal)
│   │   ├── pages/       # Page components (Login, Register, Dashboard, TreeView)
│   │   ├── services/    # API service layer
│   │   └── styles/      # CSS stylesheets
│   ├── public/          # Static files
│   └── index.html       # HTML entry point
├── uploads/             # Uploaded photos
├── server.js            # Express server entry point
├── .env.example         # Environment variables template
└── package.json         # Project dependencies
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Persons
- `GET /api/persons` - Get all persons for authenticated user
- `GET /api/persons/:id` - Get single person
- `POST /api/persons` - Create new person (with photo upload)
- `PUT /api/persons/:id` - Update person
- `DELETE /api/persons/:id` - Delete person
- `POST /api/persons/:id/relationship` - Add relationship between persons
- `GET /api/persons/search/matches` - Find potential matches with other users

## Features Explained

### Visual Tree Management
- Interactive tree visualization using D3.js
- Click on any person to view/edit details
- Color-coded nodes (blue for male, pink for female)
- Shows birth and death years
- Parent-child relationships clearly displayed

### Photo Integration
- Upload photos when creating or editing persons
- Photos displayed in cards and can be viewed in tree
- Supports JPEG, PNG, and GIF formats
- 5MB file size limit

### Automatic Matching System
- Searches for potential matches across all users' trees
- Matches based on:
  - Identical first and last names
  - Similar birth dates (±2 years)
- Displays potential connections in the dashboard

### User Privacy
- Each user can only see and edit their own family tree
- Authentication required for all person-related operations
- Secure password storage with bcrypt

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Author

Denis Billi

## Support

For issues and questions, please open an issue on the GitHub repository.
