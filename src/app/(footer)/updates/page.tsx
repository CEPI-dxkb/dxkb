"use client";

import React from "react";
import FooterHeader from "@/components/headers/footer-header";
import {
  Timeline,
  TimelineItem,
  TimelineTitle,
  TimelineDescription,
  TimelineTime,
  TimelineHeader,
} from '@/components/timeline/timeline';
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TimelineItemType } from "@/types";
import { cn } from "@/lib/utils";

const timelineData: TimelineItemType[] = [
  {
    id: 1,
    title: 'Vercel was founded in SF, USA',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    time: 'May, 2020',
  },
  {
    id: 2,
    title: 'Shadcn First Commit',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    time: 'January, 2023',
  },
  {
    id: 3,
    title: 'Shadcn Timeline 1',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    time: 'November, 2024',
  },
  {
    id: 4,
    title: 'Shadcn Timeline 2',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    time: 'November, 2024',
  },
  {
    id: 5,
    title: 'Shadcn Timeline 3',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    time: 'November, 2024',
  },

  {
    id: 6,
    title: 'Shadcn Timeline 4',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    time: 'November, 2024',
  },

  {
    id: 7,
    title: 'Shadcn Timeline 5',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    time: 'November, 2024',
  },
];

interface UpcomingEvent {
  title: string;
  description: string;
  date: {
    month: string;
    day: string;
  };
}

const upcomingEvents: UpcomingEvent[] = [
  {
    title: "Event 1 Title",
    description: "Event 1 Description",
    date: { month: "Apr", day: "10" },
  },
  {
    title: "Event 2 Title",
    description: "Event 2 Description",
    date: { month: "Apr", day: "21" },
  },
  {
    title: "Event 3 Title",
    description: "Event 3 Description",
    date: { month: "May", day: "05" },
  },
  {
    title: "Event 4 Title",
    description: "Event 4 Description",
    date: { month: "May", day: "31" },
  },
  {
    title: "Event 5 Title",
    description: "Event 4 Description",
    date: { month: "June", day: "01" },
  },
  {
    title: "Event 6 Title",
    description: "Event 4 Description",
    date: { month: "June", day: "02" },
  },
  {
    title: "Event 7 Title",
    description: "Event 4 Description",
    date: { month: "June", day: "03" },
  },
  {
    title: "Event 8 Title",
    description: "Event 4 Description",
    date: { month: "June", day: "04" },
  },
];

const Updates = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  // Function to convert event date to Date object
  const getEventDate = (eventDate: { month: string; day: string }): Date => {
    const monthNum = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'June': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    }[eventDate.month];

    return new Date(2025, monthNum!, parseInt(eventDate.day));
  };

  // Function to check if a date matches an event
  const isSelectedDateEvent = (eventDate: { month: string; day: string }) => {
    if (!date) return false;
    const monthNum = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'June': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    }[eventDate.month];

    return monthNum === date.getMonth() && parseInt(eventDate.day) === date.getDate();
  };

  // Create a map of dates that have events
  const eventDates = React.useMemo(() => {
    const dates = new Set<string>();
    upcomingEvents.forEach((event) => {
      // Parse the date string to ensure consistent format
      const monthNum = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'June': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      }[event.date.month];

      if (monthNum !== undefined) {
        const eventDate = new Date(2025, monthNum, parseInt(event.date.day));
        dates.add(eventDate.toDateString());
      }
    });
    return dates;
  }, [upcomingEvents]);

  // Custom day content renderer
  const modifiers = {
    hasEvent: (date: Date) => eventDates.has(date.toDateString())
  };

  const modifiersStyles = {
    hasEvent: {
      backgroundColor: "var(--color-secondary)",
      color: "white",
    },
    hasEventSelected: {
      backgroundColor: "var(--color-primary)",
      color: "white",
    }
  };

  // Debug log to check dates
  console.log("Event dates:", Array.from(eventDates));

  return (
    <div className="flex w-full flex-col">
      <FooterHeader title="Updates" />

      <div className="mx-auto grid w-full max-w-7xl gap-8 p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8">
          {/* Sidebar - Calendar & Events */}
          <div className="order-1 md:order-2 flex flex-col md:sticky md:top-8 space-y-8 self-start w-full md:w-[300px]">
            <Card className="w-full p-0">
              <div className="w-full p-3">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="w-full"
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                />
              </div>
            </Card>

            <Card className="w-full">
              <div className="px-4">
                <h2 className="font-semibold">Upcoming Events</h2>
              </div>
              <ScrollArea className="h-[300px] md:h-[400px]">
                {upcomingEvents.map((event, index) => (
                  <div
                    key={index}
                    onClick={() => setDate(getEventDate(event.date))}
                    className={cn(
                      "flex items-start gap-4 border-t px-4 py-3 transition-colors cursor-pointer",
                      isSelectedDateEvent(event.date) ? "bg-secondary/40" : "hover:bg-secondary/20"
                    )}
                  >
                    <div className={cn(
                      "flex flex-col items-center rounded-lg px-2 py-1",
                      isSelectedDateEvent(event.date) ? "bg-secondary" : "bg-secondary/40"
                    )}>
                      <span className="text-xs font-medium">{event.date.month}</span>
                      <span className="text-lg font-bold leading-none">
                        {event.date.day}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium leading-none">{event.title}</h3>
                      <p className="text-sm text-foreground">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </Card>
          </div>

          {/* Timeline */}
          <div className="order-2 md:order-1 space-y-12">
            <Timeline className='mt-8'>
              {timelineData.map((item) => (
                <TimelineItem key={item.id}>
                  <TimelineHeader>
                    <TimelineTime className="bg-primary">{item.time}</TimelineTime>
                    <TimelineTitle>{item.title}</TimelineTitle>
                  </TimelineHeader>
                  {item.description && (
                    <TimelineDescription>{item.description}</TimelineDescription>
                  )}
                </TimelineItem>
              ))}
            </Timeline>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Updates;