import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Users, CheckCircle, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export default function AnalyticsPage() {
  const { reportsQuery } = useApi();
  const { data, isLoading } = reportsQuery();

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-600 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-200 dark:bg-slate-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const report = data || {};
  const leadVelocity = report.lead_velocity || [];
  const monthlyValues = report.monthly_pipeline_values || [];
  const activityCounts = report.activity_counts || {};
  const pipelineStages = report.pipeline_stages || {};

  // Prepare activity chart data
  const activityData = Object.entries(activityCounts).map(([type, count]) => ({
    name: type.replace(/_/g, ' '),
    count
  }));

  // Prepare pipeline stage data for the first pipeline type
  const firstPipeline = Object.keys(pipelineStages)[0];
  const stageData = firstPipeline
    ? Object.entries(pipelineStages[firstPipeline]).map(([stage, count]) => ({
        name: stage,
        value: count
      }))
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Analytics & Reporting</h1>
        <p className="text-slate-600 dark:text-slate-400 dark:text-slate-500 mt-1">Track performance, conversions, and pipeline health</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500">Total Deals</CardTitle>
            <TrendingUp className="w-4 h-4 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{report.total_deals || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500">Won Deals</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{report.won_deals || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500">Win Rate</CardTitle>
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{report.win_rate || 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500">Avg Deal Value</CardTitle>
            <DollarSign className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">${(report.avg_deal_value || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Lead Velocity</CardTitle>
            <CardDescription>New contacts per week (last 8 weeks)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={leadVelocity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Pipeline Value</CardTitle>
            <CardDescription>Total deal value by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyValues}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  formatter={(value) => `$${value.toLocaleString()}`}
                />
                <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activity Breakdown</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" />
                <YAxis dataKey="name" type="category" width={120} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline Stage Distribution</CardTitle>
            <CardDescription>{firstPipeline ? firstPipeline.replace(/_/g, ' ') : 'No data'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
