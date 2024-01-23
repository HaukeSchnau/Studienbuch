import { db } from "@schnau/db";

export const deleteDuplicateCourseTimes = async () => {
    const courses = await db.course.findMany({
        include: {
            times: true,
        },
    });
    
    for(const course of courses) {
        const times = course.times;
        const timesToDelete = [];
        for(const time of times) {
            const duplicateTimes = times.filter(t => t.weeks === time.weeks && t.start === time.start && t.duration === time.duration && t.weekday === time.weekday);
            if(duplicateTimes.length > 1) {
                timesToDelete.push(...duplicateTimes.slice(1));
            }
        }
        if(timesToDelete.length > 0) {
            console.log(`Deleting ${timesToDelete.length} duplicate times for course ${course.id}`);
            await db.courseTime.deleteMany({
                where: {
                    id: {
                        in: timesToDelete.map(t => t.id),
                    },
                },
            });
        }
    }
};

void deleteDuplicateCourseTimes();
