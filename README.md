# Spectrum Game 🌈

A multiplayer web guessing game where players take turns as "Clue Giver" to help others guess positions on various creative spectrums.

## 🎮 Game Overview

Spectrum is a real-time multiplayer guessing game that challenges players to communicate abstract concepts through creative clues. Players take turns being the "Clue Giver" who must help others guess the position of a target point on various spectrums ranging from physical properties (like temperature) to abstract concepts (like weirdness).

### How to Play

1. **Create or Join a Room**: One player creates a room and shares the room code with friends
2. **Take Turns as Clue Giver**: Each round, one player becomes the Clue Giver
3. **Give Creative Clues**: The Clue Giver sees a target position on a spectrum and must give a clue to help others guess where it is
4. **Make Your Guess**: Other players use the clue to guess where the target point is located on the spectrum
5. **Score Points**: Players earn points based on how close their guesses are to the target. The Clue Giver earns points based on how well the group performs

### Scoring System

- **Guessers**: Earn points based on proximity to the target (closer = more points)
- **Clue Giver**: Earns points based on the average performance of all guessers
- **Bonus Points**: If all players guess within 10% of the target, the Clue Giver gets bonus points!

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd spectrum
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Server: http://localhost:3000
   - Client (dev): http://localhost:3001

### Production Deployment

1. **Start the production server**
   ```bash
   npm start
   ```

2. **Access the game**
   - Open http://localhost:3000 in your browser

## 🏗️ Project Structure

```
spectrum/
├── client/                 # Frontend application
│   ├── index.html         # Main HTML file
│   ├── css/               # Stylesheets
│   │   ├── main.css       # Core styles and layout
│   │   ├── components.css # UI component styles
│   │   └── animations.css # Animation definitions
│   ├── js/                # JavaScript modules
│   │   ├── main.js        # Application entry point
│   │   ├── game/          # Game logic modules
│   │   │   ├── GameClient.js    # Main game coordinator
│   │   │   ├── StateManager.js  # Centralized state management
│   │   │   └── GameLogic.js     # Client-side game utilities
│   │   ├── ui/            # User interface modules
│   │   │   ├── UIManager.js       # DOM manipulation and events
│   │   │   ├── SpectrumRenderer.js # Spectrum visualization
│   │   │   └── ChatManager.js     # Chat functionality
│   │   ├── network/       # Network communication
│   │   │   └── SocketClient.js    # WebSocket client
│   │   └── utils/         # Utility functions
│   │       └── helpers.js         # Common helper functions
│   └── assets/            # Static assets
│       └── sounds/        # Audio files (future)
├── server/                # Backend application
│   ├── server.js          # Main server entry point
│   ├── game/              # Game management
│   │   ├── GameManager.js   # Core game logic and rules
│   │   └── RoomManager.js   # Room lifecycle management
│   ├── network/           # Network handling
│   │   └── SocketHandler.js # WebSocket event handling
│   └── config/            # Configuration files
│       └── spectrums.json   # Spectrum definitions
├── package.json           # Project dependencies and scripts
└── README.md             # This file
```

## 🎨 Spectrum Types

The game includes 12+ creative spectrum types across different categories:

### Physical Properties
- **Temperature**: Freezing Cold ↔ Blazing Hot
- **Speed**: Extremely Slow ↔ Lightning Fast  
- **Size**: Microscopic ↔ Gigantic
- **Brightness**: Pitch Black ↔ Blinding Light
- **Age**: Brand New ↔ Ancient

### Emotions & Feelings
- **Happiness**: Deeply Sad ↔ Extremely Happy
- **Stress Level**: Completely Relaxed ↔ Extremely Stressed

### Abstract Concepts
- **Time Period**: Ancient Past ↔ Far Future
- **Complexity**: Dead Simple ↔ Mind-Bendingly Complex
- **Danger Level**: Completely Safe ↔ Extremely Dangerous
- **Weirdness**: Perfectly Normal ↔ Absolutely Bizarre

### Social Dynamics
- **Popularity**: Unknown ↔ World Famous

## 🛠️ Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development servers (both client and server)
- `npm run server:dev` - Start server in development mode with auto-reload
- `npm run client:dev` - Start client development server
- `npm run lint` - Run ESLint code analysis
- `npm run format` - Format code with Prettier

### Development Workflow

1. **Start development environment**
   ```bash
   npm run dev
   ```
   This starts both the server (port 3000) and client dev server (port 3001)

2. **Make changes**
   - Client files auto-reload on changes
   - Server restarts automatically with nodemon

3. **Test your changes**
   - Open multiple browser tabs to test multiplayer functionality
   - Use browser dev tools for debugging

### Architecture Overview

The game uses a client-server architecture with real-time communication:

- **Frontend**: Vanilla JavaScript with modular ES6 architecture
- **Backend**: Node.js with Express and Socket.io
- **Communication**: WebSocket for real-time game events
- **State Management**: Event-driven state management on both client and server
- **Responsive Design**: Mobile-first CSS with progressive enhancement

### Key Technologies

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Node.js, Express.js, Socket.io
- **Real-time Communication**: WebSockets
- **Development**: Nodemon, Live-server, ESLint, Prettier

## 🎯 Game Features

### Core Gameplay
- ✅ Real-time multiplayer (2-6 players)
- ✅ Turn-based clue giving system
- ✅ Interactive spectrum visualization
- ✅ Proximity-based scoring
- ✅ Bonus point system
- ✅ Multiple rounds with rotation

### User Interface
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Smooth animations and transitions
- ✅ Real-time chat system
- ✅ Live scoreboard
- ✅ Connection status indicators
- ✅ Touch-friendly controls

### Technical Features
- ✅ Automatic reconnection handling
- ✅ Room-based game sessions
- ✅ Real-time synchronization
- ✅ Input validation and sanitization
- ✅ Error handling and recovery
- ✅ Performance optimizations

## 🌐 Browser Support

- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+
- **Mobile browsers**: iOS Safari 14+, Chrome Mobile 90+

## 📱 Mobile Support

The game is fully responsive and optimized for mobile devices:

- Touch-friendly interface
- Swipe gestures for chat
- Optimized layouts for different screen sizes
- Performance optimizations for mobile devices

## 🔧 Configuration

### Environment Variables

Create a `.env` file for custom configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Client Configuration  
CLIENT_URL=http://localhost:3001

# Game Configuration
MAX_ROOMS=1000
ROOM_TIMEOUT=1800000
```

### Spectrum Configuration

Add new spectrums by editing `server/config/spectrums.json`:

```json
{
  "id": "your-spectrum",
  "name": "Your Spectrum Name",
  "leftLabel": "Left Side Description",
  "rightLabel": "Right Side Description", 
  "leftValue": "🔵 Left Icon",
  "rightValue": "🔴 Right Icon",
  "gradient": {
    "start": "#color1",
    "middle": "#color2", 
    "end": "#color3"
  },
  "category": "your-category",
  "difficulty": "easy|medium|hard"
}
```

## 🚀 Production Deployment

### Production-Ready Features

Spectrum has been optimized for production deployment with comprehensive enhancements:

#### Performance Optimizations
- **CSS Hardware Acceleration**: Optimized animations with `transform: translateZ(0)` and `will-change` properties
- **Resource Preloading**: Critical CSS and JavaScript files are preloaded for faster initial load
- **Efficient DOM Operations**: Minimized reflows and repaints with optimized CSS transitions
- **Network Optimization**: Compressed assets and efficient WebSocket communication

#### Progressive Web App (PWA) Support
- **Web App Manifest**: Complete PWA configuration in [`client/assets/site.webmanifest`](client/assets/site.webmanifest)
- **App Installation**: Users can install Spectrum as a native-like app on mobile and desktop
- **Offline Capabilities**: Service worker ready for offline functionality (future enhancement)
- **App Icons**: Full set of icons for different platforms and screen densities

#### Accessibility & SEO
- **ARIA Compliance**: Comprehensive ARIA labels, roles, and properties for screen readers
- **Semantic HTML**: Proper HTML5 semantic structure with landmarks and headings
- **Keyboard Navigation**: Full keyboard accessibility with proper focus management
- **SEO Optimization**: Complete meta tags, Open Graph, Twitter Cards, and structured data
- **Screen Reader Support**: Live regions and descriptive text for dynamic content

#### Enhanced User Experience
- **Micro-Interactions**: Smooth button animations, hover effects, and press feedback
- **Celebration Effects**: Special animations for achievements and perfect scores
- **Loading States**: Enhanced loading indicators with progress feedback
- **Error Handling**: Graceful error messages with smooth animations
- **Responsive Design**: Optimized for all screen sizes from mobile to desktop

### Deployment Options

#### 1. Simple VPS Deployment

**Prerequisites:**
- Node.js 18.0.0 or higher
- PM2 process manager (recommended)
- Nginx or Apache for reverse proxy (optional)

**Steps:**
1. **Upload files to server**
   ```bash
   scp -r spectrum/ user@your-server:/var/www/
   cd /var/www/spectrum
   ```

2. **Install dependencies**
   ```bash
   npm ci --only=production
   ```

3. **Configure environment**
   ```bash
   # Create production environment file
   cat > .env << EOF
   NODE_ENV=production
   PORT=3000
   MAX_ROOMS=1000
   ROOM_TIMEOUT=1800000
   EOF
   ```

4. **Start with PM2**
   ```bash
   # Install PM2 globally
   npm install -g pm2
   
   # Start the application
   pm2 start server/server.js --name spectrum-game
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

5. **Configure reverse proxy (optional)**
   ```nginx
   # Nginx configuration
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

#### 2. Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S spectrum -u 1001

# Change ownership
RUN chown -R spectrum:nodejs /app
USER spectrum

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start application
CMD ["node", "server/server.js"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  spectrum:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Deployment commands:**
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Update deployment
docker-compose pull && docker-compose up -d
```

#### 3. Cloud Platform Deployment

##### Heroku
```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create your-spectrum-app

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set NPM_CONFIG_PRODUCTION=true

# Deploy
git push heroku main

# Scale dynos
heroku ps:scale web=1
```

**Procfile:**
```
web: node server/server.js
```

##### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

##### Vercel (Serverless)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/server.js",
      "use": "@vercel/node"
    },
    {
      "src": "client/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/socket.io/(.*)",
      "dest": "/server/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/client/$1"
    }
  ]
}
```

##### DigitalOcean App Platform
```yaml
name: spectrum-game
services:
- name: web
  source_dir: /
  github:
    repo: your-username/spectrum
    branch: main
  run_command: node server/server.js
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "8080"
```

### Production Monitoring

#### Health Checks
```javascript
// Add to server/server.js
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

#### Logging
```bash
# PM2 logs
pm2 logs spectrum-game

# Docker logs
docker-compose logs -f spectrum

# Application logs
tail -f /var/log/spectrum/app.log
```

#### Performance Monitoring
- **PM2 Monitoring**: `pm2 monit`
- **Resource Usage**: Monitor CPU, memory, and network usage
- **WebSocket Connections**: Track active connections and room usage
- **Error Tracking**: Implement error logging and alerting

### Security Considerations

#### Production Security
```javascript
// Recommended security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
```

#### Environment Variables
```env
# Production environment variables
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-secure-random-string
CORS_ORIGIN=https://your-domain.com
MAX_ROOMS=1000
ROOM_TIMEOUT=1800000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Performance Optimization

#### Server Optimization
- **Clustering**: Use PM2 cluster mode for multi-core utilization
- **Caching**: Implement Redis for session storage and caching
- **CDN**: Use CDN for static assets
- **Compression**: Enable gzip compression for responses

#### Client Optimization
- **Asset Minification**: Minify CSS and JavaScript files
- **Image Optimization**: Optimize images and use WebP format
- **Lazy Loading**: Implement lazy loading for non-critical resources
- **Service Worker**: Add service worker for caching and offline support

### Scaling Considerations

#### Horizontal Scaling
- **Load Balancer**: Use nginx or cloud load balancer
- **Session Affinity**: Configure sticky sessions for WebSocket connections
- **Database**: Add Redis for shared state across instances
- **Message Queue**: Implement Redis pub/sub for cross-instance communication

#### Monitoring & Alerts
- **Uptime Monitoring**: Use services like Pingdom or UptimeRobot
- **Error Tracking**: Implement Sentry or similar error tracking
- **Performance Monitoring**: Use New Relic or DataDog
- **Log Aggregation**: Use ELK stack or cloud logging services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add comments for complex logic
- Test multiplayer functionality
- Ensure mobile compatibility
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎉 Acknowledgments

- Inspired by party games and creative communication challenges
- Built with modern web technologies for optimal performance
- Designed for accessibility and inclusive gameplay

## 📞 Support

If you encounter any issues or have questions:

1. Check the browser console for error messages
2. Ensure you're using a supported browser
3. Try refreshing the page or restarting the server
4. Open an issue on the project repository

---

**Have fun playing Spectrum! 🌈**