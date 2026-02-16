import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { LayoutGrid, Table2 } from 'lucide-react';

interface ButtonGroupViewProps {
  viewMode: 'card' | 'table';
  setViewMode: (mode: 'card' | 'table') => void;
}

function ViewButtons({ viewMode, setViewMode }: ButtonGroupViewProps) {
  return (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'card' | 'table')}>
      <TabsList className="h-8 rounded-lg border border-input bg-muted/80 p-0.5">
        <TabsTrigger value="card" className="gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-[state=active]:shadow-sm">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          Card
        </TabsTrigger>
        <TabsTrigger value="table" className="gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-[state=active]:shadow-sm">
          <Table2 className="h-3.5 w-3.5" aria-hidden />
          Table
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default ViewButtons;
