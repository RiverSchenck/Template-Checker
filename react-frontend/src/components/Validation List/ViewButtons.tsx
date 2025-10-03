import { Button } from 'antd';

interface ButtonGroupViewProps {
  viewMode: 'card' | 'table'; // Assuming viewMode can only be 'card' or 'table'
  setViewMode: (mode: 'card' | 'table') => void; // Function that accepts a 'card' or 'table' string
}

function ViewButtons({ viewMode, setViewMode }: ButtonGroupViewProps) {
  
  return (
    <Button.Group>
      <Button
        type={viewMode === 'card' ? 'primary' : 'default'}
        onClick={() => setViewMode('card')}
        style={{ fontSize: '12px', padding: '0px 8px',}}
      >
        Card View
      </Button>
      <Button
        type={viewMode === 'table' ? 'primary' : 'default'}
        onClick={() => setViewMode('table')}
        style={{ fontSize: '12px', padding: '0px 8px',}}
      >
        Table View
      </Button>
    </Button.Group>
  );
};



export default ViewButtons;
