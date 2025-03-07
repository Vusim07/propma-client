import React, { createContext, useState, useContext, ReactNode } from 'react';

interface PageTitleContextType {
	pageTitle: string;
	setPageTitle: (title: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType>({
	pageTitle: '',
	setPageTitle: () => {},
});

export const PageTitleProvider: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const [pageTitle, setPageTitle] = useState('Dashboard');

	return (
		<PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
			{children}
		</PageTitleContext.Provider>
	);
};

export const usePageTitle = () => useContext(PageTitleContext);
