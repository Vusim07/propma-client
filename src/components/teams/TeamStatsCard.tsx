import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { AlertCircle, BadgeCheck } from 'lucide-react';
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
	const totalMembers = memberCount + pendingInvites;
	const usagePercentage = (totalMembers / team.max_members) * 100;
	const isNearLimit = usagePercentage >= 80;
	const isAtLimit = totalMembers >= team.max_members;

	return (
		<Card className={`${className} overflow-hidden`}>
			<CardContent className='p-6'>
				<div className='space-y-4'>
					<div className='flex items-center justify-between'>
						<div>
							<h3 className='font-semibold text-xl'>{team.name}</h3>
							<div className='flex items-center gap-2 mt-1'>
								{team.subscription?.status === 'active' ? (
									<BadgeCheck className='h-4 w-4 text-green-500' />
								) : (
									<AlertCircle className='h-4 w-4 text-yellow-500' />
								)}
								<span
									className={`text-sm ${
										team.subscription?.status === 'active'
											? 'text-green-600'
											: 'text-yellow-600'
									}`}
								>
									{team.subscription?.plan_name || 'No'} Plan •{' '}
									{team.subscription?.status === 'active'
										? 'Active'
										: 'Inactive'}
								</span>
							</div>
						</div>
					</div>

					<div className='space-y-2'>
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
									isAtLimit
										? 'bg-red-500'
										: isNearLimit
										? 'bg-yellow-500'
										: 'bg-blue-500'
								} ${
									usagePercentage > 0
										? `w-[${Math.min(usagePercentage, 100)}%]`
										: 'w-0'
								}`}
							/>
						</div>

						<div className='flex justify-between items-center text-sm'>
							<span className='text-gray-600'>
								{totalMembers} / {team.max_members} members
							</span>
							{isAtLimit && (
								<span className='text-red-600 flex items-center gap-1'>
									<AlertCircle className='h-4 w-4' />
									At capacity
								</span>
							)}
							{!isAtLimit && isNearLimit && (
								<span className='text-yellow-600 flex items-center gap-1'>
									<AlertCircle className='h-4 w-4' />
									Near capacity
								</span>
							)}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
