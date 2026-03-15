import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from '../pages/public/HomePage';
import './styles/reset.css';
import './styles/variables.css';
import './styles/global.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
