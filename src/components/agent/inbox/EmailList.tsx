
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Paperclip } from "lucide-react";

interface Email {
  id: string;
  sender: string;
  email: string;
  subject: string;
  preview: string;
  time: string;
  isUnread: boolean;
  hasAttachment: boolean;
  avatar: string;
  leadSource?: string;
  needsFollowUp?: boolean;
}

interface EmailListProps {
  emails: Email[];
  selectedEmail: Email | null;
  onSelectEmail: (email: Email) => void;
}

const getLeadSourceColor = (source: string) => {
  switch (source.toLowerCase()) {
    case 'property24':
      return 'bg-blue-100 text-blue-800';
    case 'privateproperty':
      return 'bg-green-100 text-green-800';
    case 'gumtree':
      return 'bg-orange-100 text-orange-800';
    case 'olx':
      return 'bg-purple-100 text-purple-800';
    case 'website':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const EmailList: React.FC<EmailListProps> = ({ emails, selectedEmail, onSelectEmail }) => {
  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-gray-100">
        {emails.map((email) => (
          <div
            key={email.id}
            className={`p-4 cursor-pointer hover:bg-gray-50 ${
              selectedEmail?.id === email.id ? "bg-blue-50 border-r-2 border-blue-600" : ""
            }`}
            onClick={() => onSelectEmail(email)}
          >
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={email.avatar} alt={email.sender} />
                <AvatarFallback>{email.sender.charAt(0)}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-sm font-medium truncate ${
                    email.isUnread ? "text-gray-900" : "text-gray-700"
                  }`}>
                    {email.sender}
                  </h3>
                  <span className="text-xs text-gray-500 ml-2">{email.time}</span>
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-sm truncate ${
                    email.isUnread ? "font-medium text-gray-900" : "text-gray-700"
                  }`}>
                    {email.subject}
                  </p>
                  {email.hasAttachment && (
                    <Paperclip className="h-3 w-3 text-gray-400" />
                  )}
                </div>
                
                <p className="text-sm text-gray-500 truncate mb-2">{email.preview}</p>
                
                <div className="flex items-center gap-2">
                  {email.isUnread && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      New
                    </Badge>
                  )}
                  {email.needsFollowUp && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                      Follow-up
                    </Badge>
                  )}
                  {email.leadSource && (
                    <Badge className={`text-xs ${getLeadSourceColor(email.leadSource)}`}>
                      {email.leadSource}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default EmailList;
