
import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Settings, Bell, Mail, Star, Trash2, Archive, Flag, Paperclip, Download, Send } from "lucide-react";

const Sidebar = () => {
  const menuItems = [
    { icon: Mail, label: "Dashboard", active: false },
    { icon: Bell, label: "Contacts", active: false },
    { icon: Star, label: "Sales Pipeline", active: false },
    { icon: Archive, label: "Tasks", active: false },
    { icon: Mail, label: "Inbox", active: true },
    { icon: Flag, label: "Analytics", active: false },
    { icon: Settings, label: "Settings", active: false },
    { icon: Paperclip, label: "Help Center", active: false },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
            <span className="text-white text-sm font-bold">T</span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Triangle</h2>
            <p className="text-xs text-gray-500">Free Plan</p>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search something..." 
            className="pl-10 text-sm"
          />
        </div>
      </div>
      
      {/* Navigation */}
      <div className="flex-1 p-4">
        <nav className="space-y-1">
          {menuItems.map((item, index) => (
            <Button
              key={index}
              variant={item.active ? "secondary" : "ghost"}
              className={`w-full justify-start ${
                item.active ? "bg-gray-100" : ""
              }`}
            >
              <item.icon className="h-4 w-4 mr-3" />
              {item.label}
            </Button>
          ))}
        </nav>
      </div>
      
      {/* Upgrade Card */}
      <div className="p-4 border-t border-gray-200">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Ready to unlock more power?</h3>
          <p className="text-sm text-gray-600 mb-3">
            Upgrade to Pro and supercharge your workflow.
          </p>
          <Button className="w-full bg-blue-600 hover:bg-blue-700">
            Upgrade to Pro
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Sidebar;
