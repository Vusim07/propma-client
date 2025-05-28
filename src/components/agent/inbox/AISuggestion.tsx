
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AISuggestionProps {
  type: "status" | "reminder";
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

const AISuggestion: React.FC<AISuggestionProps> = ({ 
  type, 
  title, 
  message, 
  actionText, 
  onAction 
}) => {
  const getCardStyles = () => {
    switch (type) {
      case "status":
        return "border border-blue-200 bg-blue-50";
      case "reminder":
        return "border border-yellow-200 bg-yellow-50";
      default:
        return "border border-gray-200 bg-gray-50";
    }
  };

  const getIconStyles = () => {
    switch (type) {
      case "status":
        return "w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center";
      case "reminder":
        return "w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center";
      default:
        return "w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center";
    }
  };

  const getTextStyles = () => {
    switch (type) {
      case "status":
        return {
          title: "text-blue-900",
          message: "text-blue-800",
          button: "text-blue-600 border-blue-600"
        };
      case "reminder":
        return {
          title: "text-yellow-900",
          message: "text-yellow-800",
          button: "text-yellow-600 border-yellow-600"
        };
      default:
        return {
          title: "text-gray-900",
          message: "text-gray-800",
          button: "text-gray-600 border-gray-600"
        };
    }
  };

  const styles = getTextStyles();

  return (
    <Card className={getCardStyles()}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={getIconStyles()}>
            <span className="text-white text-xs">AI</span>
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium mb-1 ${styles.title}`}>{title}</p>
            <p className={`text-sm mb-2 ${styles.message}`}>{message}</p>
            {actionText && onAction && (
              <Button 
                size="sm" 
                variant="outline" 
                className={styles.button}
                onClick={onAction}
              >
                {actionText}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AISuggestion;
