import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './theme.css'
import './tailwind.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
)
