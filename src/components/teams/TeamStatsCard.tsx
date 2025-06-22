import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, BadgeCheck, Users, CreditCard } from 'lucide-react';
import { Team } from '@/types';

interface TeamStatsCardProps {
	team: Team;
	memberCount: number;
	pendingInvites: number;
	className?: string;
}

export const TeamStatsCard: React.FC<TeamStatsCardProps> = ({
	team,
	memberCount,
	pendingInvites,
	className = '',
}) => {
	// Member counts and limits
	const totalMembers = memberCount + pendingInvites;
	const memberPercentage = (totalMembers / team.max_members) * 100;
	const isNearMemberLimit = memberPercentage >= 80;
	const isAtMemberLimit = totalMembers >= team.max_members;

	// Subscription and usage stats
	const hasActiveSubscription =
		team.subscription?.status === 'active' ||
		(!!team.subscription_id &&
			team.subscription?.status !== 'inactive' &&
			team.subscription?.status !== 'cancelled');

	const planName = team.subscription?.plan_name || team.plan_type || 'No';

	// Usage stats - these come from the subscription if it exists
	const usageLimit = team.subscription?.usage_limit || 0;
	const currentUsage = team.subscription?.current_usage || 0;
	const usagePercentage =
		usageLimit > 0 ? (currentUsage / usageLimit) * 100 : 0;
	const isNearUsageLimit = usagePercentage >= 80;
	const isAtUsageLimit = currentUsage >= usageLimit;

	// Calculate progress bar widths
	const memberProgressWidth = `${Math.min(memberPercentage, 100)}%`;
	const usageProgressWidth = `${Math.min(usagePercentage, 100)}%`;

	return (
		<Card className={`${className} overflow-hidden`}>
			<CardContent className='p-6'>
				<div className='space-y-4'>
					<div className='flex items-center justify-between'>
						<div>
							<h3 className='font-semibold text-xl'>{team.name}</h3>
							<div className='flex items-center gap-2 mt-1'>
								{hasActiveSubscription ? (
									<BadgeCheck className='h-4 w-4 text-green-500' />
								) : (
									<AlertCircle className='h-4 w-4 text-yellow-500' />
								)}
								<span
									className={`text-sm ${
										hasActiveSubscription ? 'text-green-600' : 'text-yellow-600'
									}`}
								>
									{planName} Plan
								</span>
							</div>
						</div>
					</div>

					{/* Team members section */}
					<div className='space-y-2'>
						<div className='flex items-center gap-2 text-sm font-medium text-gray-700'>
							<Users className='h-4 w-4' />
							<h4>Team Members</h4>
						</div>

						<div className='flex justify-between text-sm text-gray-600'>
							<span>
								{memberCount} active member{memberCount !== 1 ? 's' : ''}
							</span>
							{pendingInvites > 0 && (
								<span>
									{pendingInvites} pending invite
									{pendingInvites !== 1 ? 's' : ''}
								</span>
							)}
						</div>

						<div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
							<div
								className={`h-full transition-all duration-300 ${
									isAtMemberLimit
										? 'bg-red-500'
										: isNearMemberLimit
										? 'bg-yellow-500'
										: 'bg-blue-500'
								}`}
								style={{ width: memberProgressWidth }}
							/>
						</div>

						<div className='flex justify-between items-center text-sm'>
							<span className='text-gray-600'>
								{totalMembers} / {team.max_members} members
							</span>
							{isAtMemberLimit && (
								<span className='text-red-600 flex items-center gap-1'>
									<AlertCircle className='h-4 w-4' />
									At capacity
								</span>
							)}
							{!isAtMemberLimit && isNearMemberLimit && (
								<span className='text-yellow-600 flex items-center gap-1'>
									<AlertCircle className='h-4 w-4' />
									Near capacity
								</span>
							)}
						</div>
					</div>

					{/* Screening credits section - only show if there's an active subscription */}
					{hasActiveSubscription && usageLimit > 0 && (
						<div className='space-y-2 pt-2 border-t border-gray-100'>
							<div className='flex items-center gap-2 text-sm font-medium text-gray-700'>
								<CreditCard className='h-4 w-4' />
								<h4>Screening Credits</h4>
							</div>

							<div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
								<div
									className={`h-full transition-all duration-300 ${
										isAtUsageLimit
											? 'bg-red-500'
											: isNearUsageLimit
											? 'bg-yellow-500'
											: 'bg-green-500'
									}`}
									style={{ width: usageProgressWidth }}
								/>
							</div>

							<div className='flex justify-between items-center text-sm'>
								<span className='text-gray-600'>
									{currentUsage} / {usageLimit} credits used
								</span>
								{isAtUsageLimit && (
									<span className='text-red-600 flex items-center gap-1'>
										<AlertCircle className='h-4 w-4' />
										Limit reached
									</span>
								)}
								{!isAtUsageLimit && isNearUsageLimit && (
									<span className='text-yellow-600 flex items-center gap-1'>
										<AlertCircle className='h-4 w-4' />
										Running low
									</span>
								)}
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
};
