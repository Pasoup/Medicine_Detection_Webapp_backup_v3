import medsureLogo from '../assets/medsure.jpg';

export default function Navbar() {
  return (
  <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 w-full">
      
      {/* Removed 'max-w-7xl mx-auto' and added 'w-full' so it spans the whole screen */}
      <div className="w-full px-20 h-14 flex items-center">
        
        {/* Swapped w-30 for w-32 (which is exactly 128px wide) */}
        <div className="w-32 h-11">
          <img 
            src={medsureLogo} 
            alt="Medsure Logo" 
            className="w-full h-full object-contain object-left" 
          />
        </div>
        
      </div>
    </nav>
  );
}