import React from 'react';

interface CardProps {
	children: React.ReactNode;
	className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
	return (
		<div
			className={`bg-white shadow-sm rounded-lg border border-gray-200 ${
				className || ''
			}`}
		>
			{children}
		</div>
	);
};

interface CardHeaderProps {
	children: React.ReactNode;
	className?: string;
}

const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => {
	return (
		<div className={`px-6 py-4 border-b border-gray-200 ${className || ''}`}>
			{children}
		</div>
	);
};

interface CardContentProps {
	children: React.ReactNode;
	className?: string;
}

const CardContent: React.FC<CardContentProps> = ({ children, className }) => {
	return <div className={`p-6 ${className || ''}`}>{children}</div>;
};

interface CardFooterProps {
	children: React.ReactNode;
	className?: string;
}

const CardFooter: React.FC<CardFooterProps> = ({ children, className }) => {
	return (
		<div className={`px-6 py-4 border-t border-gray-200 ${className || ''}`}>
			{children}
		</div>
	);
};

interface CardTitleProps {
	children: React.ReactNode;
	className?: string;
}

const CardTitle: React.FC<CardTitleProps> = ({ children, className }) => {
	return (
		<h3 className={`text-lg font-semibold ${className || ''}`}>{children}</h3>
	);
};

interface CardDescriptionProps {
	children: React.ReactNode;
	className?: string;
}

const CardDescription: React.FC<CardDescriptionProps> = ({
	children,
	className,
}) => {
	return (
		<p className={`text-sm text-gray-500 mt-1 ${className || ''}`}>
			{children}
		</p>
	);
};

export {
	Card,
	CardHeader,
	CardContent,
	CardFooter,
	CardTitle,
	CardDescription,
};
