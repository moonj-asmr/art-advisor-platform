import React from 'react';

export const Tabs = ({ defaultValue, className = '', children }) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <div className={className}>
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { activeTab, setActiveTab });
      })}
    </div>
  );
};

export const TabsList = ({ className = '', children, activeTab, setActiveTab }) => (
  <div className={`flex space-x-4 ${className}`}>
    {React.Children.map(children, child => {
      if (!React.isValidElement(child)) return child;
      return React.cloneElement(child, { activeTab, setActiveTab });
    })}
  </div>
);

export const TabsTrigger = ({ value, children, activeTab, setActiveTab }) => (
  <button
    className={`px-4 py-2 rounded-lg transition-colors ${activeTab === value ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
    onClick={() => setActiveTab(value)}
  >
    {children}
  </button>
);

export const TabsContent = ({ value, children, activeTab }) => {
  if (activeTab !== value) return null;
  return <div>{children}</div>;
};