import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const ForbiddenPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-foreground mb-3">403</h1>
        <p className="text-muted-foreground mb-6">У вас нет доступа к этому разделу.</p>
        <Link to="/">
          <Button variant="gold">На главную</Button>
        </Link>
      </div>
    </div>
  );
};

export default ForbiddenPage;
