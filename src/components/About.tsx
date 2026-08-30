import { displayFont } from "@/lib/fonts";

/** Bio scene with the studio photo behind it. */
export function About() {
    return (
        <div className="about-inner">
            <div className="about-bg">
                <img
                    src="/studio.jpg"
                    alt="Joshua Whatman producing music at a computer in his recording studio as Spencer Lee plays bass behind him."
                />
            </div>

            <div className="about-content">
                <h2 className={`${displayFont.className} about-title`}>About Me</h2>

                <div className="about-copy">
                    <p className="about-lead">Sound Designer, Music Producer - Victoria, BC</p>

                    <p>
                        I’ve worked in audio for more than 15 years, across music production,
                        studio recording, audio post, radio, concert production, live recording, and more.
                        That range of experience, along with my (at times, unsettling) passion for this craft
                        has given me a deep and practical understanding of sound and audio
                        production, informing every detail in my work today.
                    </p>

                    <p>
                        Audio can make or break a project. If you need someone who will obsess over every
                        detail of your project, I&apos;m your guy.
                    </p>
                </div>
            </div>
        </div>
    );
}
